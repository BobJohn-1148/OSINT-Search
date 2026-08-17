/**
 * Agent runtime tests use real SQLite because Phase 5 is about durable
 * provenance, not just UI state. If these tests mocked repositories, uncited
 * findings or missing case saves could slip into the runtime contract.
 */
import Database from "better-sqlite3";
import { runMigrations } from "../../src/db/migrations/runner";
import { AgentRuntimeRepository } from "../../src/db/repositories/agent-runtime-repository";
import { AgentsRepository } from "../../src/db/repositories/agents-repository";
import { AuditRepository } from "../../src/db/repositories/audit-repository";
import { CasesRepository } from "../../src/db/repositories/cases-repository";
import { AgentRuntimeService, defaultAgentCaseTitle } from "../../src/main/agents/agent-runtime-service";
import { AgentEventBatcher } from "../../src/main/agents/agent-event-batcher";
import { agentFindingSchema, STEP_FORMAT, type AgentRuntimeEvent } from "../../src/shared/schemas/agents-runtime";

function createRuntime() {
  const db = new Database(":memory:");
  runMigrations(db);
  const agentsRepository = new AgentsRepository(db);
  const runtimeRepository = new AgentRuntimeRepository(db);
  const casesRepository = new CasesRepository(db);
  const auditRepository = new AuditRepository(db);
  const events: AgentRuntimeEvent[][] = [];
  const service = new AgentRuntimeService(
    agentsRepository,
    runtimeRepository,
    casesRepository,
    auditRepository,
    (batch) => {
      events.push([...batch]);
    },
    process.cwd(),
    () => new Date("2026-08-11T12:00:00.000Z")
  );
  return { agentsRepository, auditRepository, casesRepository, events, runtimeRepository, service };
}

it("STEP_FORMAT parses a step with null summary and next so strict providers accept empty planning fields", () => {
  expect(
    STEP_FORMAT.parse({
      runId: "run-one",
      agentId: "osint-agent",
      sequence: 1,
      title: "Think",
      status: "running",
      summary: null,
      next: null,
      sources: []
    })
  ).toMatchObject({ summary: null, next: null });
});

it("a finding without a source is rejected so uncited claims cannot enter memory", () => {
  expect(() =>
    agentFindingSchema.parse({
      id: "finding-one",
      runId: "run-one",
      agentId: "osint-agent",
      caseId: "case-one",
      title: "Uncited lead",
      summary: "Trust me",
      sources: [],
      confidence: 1,
      savedItemId: null
    })
  ).toThrow();
});

it("memory written by agent A is readable by agent B on a different provider", async () => {
  const { agentsRepository, runtimeRepository, service } = createRuntime();
  agentsRepository.setModel("byte-agent", "xai", "grok-4");

  await service.run({ agentId: "osint-agent", seed: { type: "username", value: "jdoe" } });
  const byteRun = await service.run({ agentId: "byte-agent", seed: { type: "domain", value: "example.com" } });
  const byteSteps = runtimeRepository.listSteps(byteRun.run.id);
  const byteAgent = agentsRepository.get("byte-agent");

  expect(byteAgent.provider).toBe("xai");
  expect(byteSteps[0]?.summary).toContain("1 memory rows");
});

it("run history persists and reloads so previous agent work survives restart", async () => {
  const { runtimeRepository, service } = createRuntime();

  await service.run({ agentId: "osint-agent", seed: { type: "domain", value: "example.com" } });

  expect(runtimeRepository.listRuns("osint-agent")).toHaveLength(1);
  expect(runtimeRepository.listRuns("osint-agent")[0]?.seed).toEqual({ type: "domain", value: "example.com" });
});

it("streams steps and cited findings so the HQ only receives batched events", async () => {
  const { events, service } = createRuntime();

  await service.run({ agentId: "osint-agent", seed: { type: "username", value: "jdoe" } });
  const flattened = events.flat();

  expect(events).toHaveLength(1);
  expect(flattened.some((event) => event.type === "agent:step")).toBe(true);
  expect(flattened.some((event) => event.type === "agent:finding" && event.finding.sources.length > 0)).toBe(true);
});

it("findings are saved to case and memory so agent output becomes evidence", async () => {
  const { casesRepository, runtimeRepository, service } = createRuntime();
  const caseRecord = casesRepository.create("Agent case", []);

  const result = await service.run({
    agentId: "osint-agent",
    seed: { type: "email", value: "alice@example.com" },
    caseId: caseRecord.id
  });

  expect(result.finding.savedItemId).toBeTruthy();
  expect(casesRepository.timeline(caseRecord.id).map((item) => item.title)).toEqual([result.finding.title]);
  expect(runtimeRepository.listMemory("global", 10).map((item) => item.key)).toEqual(["email:alice@example.com"]);
});

it("auto-created agent cases use a short seed label instead of leaking mission brief text into every case dropdown", async () => {
  expect(defaultAgentCaseTitle({ type: "domain", value: "example.com" })).toBe("Agent findings: domain example.com");
  expect(defaultAgentCaseTitle({
    type: "business",
    value: "Follow the mission brief, cite sources, and save only evidence-backed findings."
  })).toBe("Agent findings: business");

  const { casesRepository, service } = createRuntime();
  await service.run({
    agentId: "osint-agent",
    seed: {
      type: "business",
      value: "Follow the mission brief, cite sources, and save only evidence-backed findings."
    }
  });

  expect(casesRepository.list().map((caseRecord) => caseRecord.title)).toEqual(["Agent findings: business"]);
});

it("marks a run failed and emits error state when a post-start save fails", async () => {
  const { casesRepository, events, runtimeRepository, service } = createRuntime();
  const addItem = vi.spyOn(casesRepository, "addItem").mockImplementation(() => {
    throw new Error("stale case save failed");
  });

  await expect(service.run({ agentId: "osint-agent", seed: { type: "username", value: "jdoe" } })).rejects.toThrow(
    /stale case save failed/
  );

  expect(runtimeRepository.listRuns("osint-agent")[0]).toMatchObject({ status: "failed", error: "stale case save failed" });
  const errorState = events
    .flat()
    .find((event) => event.type === "agent:state" && event.state.status === "error");
  expect(errorState).toMatchObject({
    type: "agent:state",
    state: { status: "error", task: "stale case save failed" }
  });
  addItem.mockRestore();
});

it("cleans up saved case evidence when a run fails after case save", async () => {
  const { casesRepository, runtimeRepository, service } = createRuntime();
  const caseRecord = casesRepository.create("Agent case", []);
  const appendMemory = vi.spyOn(runtimeRepository, "appendMemory").mockImplementation(() => {
    throw new Error("memory write failed");
  });

  await expect(
    service.run({
      agentId: "osint-agent",
      seed: { type: "email", value: "alice@example.com" },
      caseId: caseRecord.id
    })
  ).rejects.toThrow(/memory write failed/);

  expect(runtimeRepository.listRuns("osint-agent")[0]).toMatchObject({ status: "failed", error: "memory write failed" });
  expect(casesRepository.timeline(caseRecord.id)).toEqual([]);
  expect(runtimeRepository.listMemory("global", 10)).toEqual([]);
  appendMemory.mockRestore();
});

it("batches agent events into capped chunks so chatty providers cannot freeze labels", () => {
  const batches: AgentRuntimeEvent[][] = [];
  const batcher = new AgentEventBatcher((events) => batches.push([...events]), 2, 1000);
  const state = {
    type: "agent:state" as const,
    state: {
      agentId: "osint-agent",
      status: "working" as const,
      task: "running Sherlock on jdoe",
      lastRunId: "run-one",
      updatedTs: "2026-08-11T12:00:00.000Z"
    }
  };

  batcher.push(state);
  batcher.push(state);

  expect(batches).toHaveLength(1);
  expect(batches[0]).toHaveLength(2);
});
