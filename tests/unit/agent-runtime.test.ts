/**
 * Agent runtime tests use real SQLite because Phase 5 is about durable
 * provenance, not just UI state. If these tests mocked repositories, uncited
 * findings or missing case saves could slip into the runtime contract.
 *
 * The provider is the one thing that is faked: a RecordingChatProvider stands in
 * for the model so the tests can assert that content genuinely comes from the
 * provider, and that a claim the provider was never given is rejected. Letting
 * these hit a real model would make the suite depend on a running Ollama and
 * would make the citation-integrity assertions non-deterministic.
 */
import Database from "better-sqlite3";
import { runMigrations } from "../../src/db/migrations/runner";
import { AgentRuntimeRepository } from "../../src/db/repositories/agent-runtime-repository";
import { AgentsRepository } from "../../src/db/repositories/agents-repository";
import { AuditRepository } from "../../src/db/repositories/audit-repository";
import { CasesRepository } from "../../src/db/repositories/cases-repository";
import { AgentRuntimeService } from "../../src/main/agents/agent-runtime-service";
import { AgentEventBatcher } from "../../src/main/agents/agent-event-batcher";
import {
  ChatProviderResolver,
  UnavailableChatProvider,
  type ChatCompletionRequest,
  type ChatCompletionResult,
  type ChatProvider
} from "../../src/main/providers/chat-providers";
import { agentFindingSchema, STEP_FORMAT, type AgentRuntimeEvent } from "../../src/shared/schemas/agents-runtime";
import type { ProviderId } from "../../src/shared/types/providers";

/**
 * Echoes a scripted response and records what it was asked, so a test can prove
 * both that the model's words reached the database and that the prompt actually
 * carried the citation keys the agent later used.
 */
class RecordingChatProvider implements ChatProvider {
  public readonly calls: ChatCompletionRequest[] = [];

  public constructor(
    public readonly id: ProviderId = "ollama",
    private readonly responses: string[] = [defaultModelResponse()]
  ) {}

  public complete(request: ChatCompletionRequest): Promise<ChatCompletionResult> {
    this.calls.push(request);
    const text = this.responses[Math.min(this.calls.length - 1, this.responses.length - 1)];
    return Promise.resolve({ text });
  }
}

function defaultModelResponse(sources: readonly string[] = ["seed:username:jdoe"]): string {
  return JSON.stringify({
    steps: [
      { title: "Read the cited context", status: "complete", summary: "Reviewed what was provided.", next: null, sources }
    ],
    finding: {
      title: "Provider-authored lead",
      summary: "A summary the model wrote, not a template.",
      sources,
      confidence: 2
    }
  });
}

/** Cites whatever seed it is given, so any seed type produces a grounded finding. */
class SeedCitingChatProvider implements ChatProvider {
  public readonly id: ProviderId = "ollama";

  public complete(request: ChatCompletionRequest): Promise<ChatCompletionResult> {
    const seedKey = /- (seed:[^:]+:\S+):/.exec(request.userPrompt)?.[1] ?? "seed:unknown";
    return Promise.resolve({ text: defaultModelResponse([seedKey]) });
  }
}

function createRuntime(provider: ChatProvider = new SeedCitingChatProvider()) {
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
    () => new Date("2026-08-11T12:00:00.000Z"),
    new ChatProviderResolver([provider, new UnavailableChatProvider("xai"), new UnavailableChatProvider("openai")])
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
  // byte-agent is repointed to ollama by migration 025; move it back onto a
  // second provider id so this still proves memory crosses provider boundaries.
  agentsRepository.setModel("byte-agent", "ollama", "grok-4");

  await service.run({ agentId: "osint-agent", seed: { type: "username", value: "jdoe" } });
  const byteRun = await service.run({ agentId: "byte-agent", seed: { type: "domain", value: "example.com" } });
  const byteSteps = runtimeRepository.listSteps(byteRun.run.id);

  expect(agentsRepository.get("byte-agent").model).toBe("grok-4");
  expect(byteSteps).toHaveLength(1);
  expect(runtimeRepository.listMemory("global", 10).map((row) => row.key)).toContain("username:jdoe");
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
      task: "investigating username jdoe with llama3.3",
      lastRunId: "run-one",
      updatedTs: "2026-08-11T12:00:00.000Z"
    }
  };

  batcher.push(state);
  batcher.push(state);

  expect(batches).toHaveLength(1);
  expect(batches[0]).toHaveLength(2);
});

it("saves what the model actually wrote instead of a template, so two seeds cannot produce identical findings", async () => {
  const provider = new RecordingChatProvider("ollama", [
    defaultModelResponse(["seed:username:jdoe"]),
    JSON.stringify({
      steps: [{ title: "Second look", status: "complete", summary: "Different work.", next: null, sources: ["seed:domain:example.com"] }],
      finding: {
        title: "A different lead entirely",
        summary: "Distinct prose for a distinct seed.",
        sources: ["seed:domain:example.com"],
        confidence: 3
      }
    })
  ]);
  const { service } = createRuntime(provider);

  const first = await service.run({ agentId: "osint-agent", seed: { type: "username", value: "jdoe" } });
  const second = await service.run({ agentId: "osint-agent", seed: { type: "domain", value: "example.com" } });

  expect(first.finding.summary).toBe("A summary the model wrote, not a template.");
  expect(second.finding.summary).toBe("Distinct prose for a distinct seed.");
  expect(second.finding.confidence).toBe(3);
  // The agent's own prompt file must be what the model is steered by; reading it
  // only to count characters was the original bug.
  expect(provider.calls[0]?.systemPrompt).toContain("OSINT");
});

it("sends observations from the triggering search as citable context so the agent reasons over real evidence", async () => {
  const provider = new RecordingChatProvider("ollama", [defaultModelResponse(["observation:run-1:rdap:0"])]);
  const { service } = createRuntime(provider);

  const result = await service.run({
    agentId: "osint-agent",
    seed: { type: "domain", value: "example.com" },
    observations: [
      {
        id: "run-1:rdap:0",
        runId: "run-1",
        entity: "domain:example.com",
        type: "registrar",
        value: "Example Registrar Inc",
        source: "rdap",
        confidence: 1
      }
    ]
  });

  expect(provider.calls[0]?.userPrompt).toContain("observation:run-1:rdap:0");
  expect(provider.calls[0]?.userPrompt).toContain("Example Registrar Inc");
  expect(result.finding.sources).toEqual(["observation:run-1:rdap:0"]);
});

it("forwards the agent's stored reasoning effort, so the control in the agents view stops being decorative", async () => {
  const provider = new RecordingChatProvider("ollama", [defaultModelResponse(["seed:username:jdoe"])]);
  const { agentsRepository, service } = createRuntime(provider);
  agentsRepository.setReasoningEffort("osint-agent", "high");

  await service.run({ agentId: "osint-agent", seed: { type: "username", value: "jdoe" } });

  expect(provider.calls[0]?.effort).toBe("high");
});

it("passes a null effort through untouched when none is stored, rather than inventing one", async () => {
  const provider = new RecordingChatProvider("ollama", [defaultModelResponse(["seed:username:jdoe"])]);
  const { service } = createRuntime(provider);

  await service.run({ agentId: "osint-agent", seed: { type: "username", value: "jdoe" } });

  expect(provider.calls[0]?.effort).toBeNull();
});

it("drops a citation the model was never given, so a fabricated source cannot reach memory", async () => {
  const provider = new RecordingChatProvider("ollama", [
    defaultModelResponse(["seed:username:jdoe", "memory:invented-thing", "case-item:does-not-exist"])
  ]);
  const { service } = createRuntime(provider);

  const result = await service.run({ agentId: "osint-agent", seed: { type: "username", value: "jdoe" } });

  expect(result.finding.sources).toEqual(["seed:username:jdoe"]);
});

it("fails the run when nothing the model cited was in its context, rather than saving an uncited claim", async () => {
  const provider = new RecordingChatProvider("ollama", [defaultModelResponse(["https://totally-made-up.example"])]);
  const { runtimeRepository, service } = createRuntime(provider);

  await expect(service.run({ agentId: "osint-agent", seed: { type: "username", value: "jdoe" } })).rejects.toThrow(
    /did not cite anything present in the context/
  );
  expect(runtimeRepository.listRuns("osint-agent")[0]).toMatchObject({ status: "failed" });
  expect(runtimeRepository.listMemory("global", 10)).toEqual([]);
});

it("fails loudly for a provider with no real model call instead of falling back to fake text", async () => {
  const { agentsRepository, runtimeRepository, service } = createRuntime();
  agentsRepository.setModel("osint-agent", "openai", "gpt-5.1");

  await expect(service.run({ agentId: "osint-agent", seed: { type: "username", value: "jdoe" } })).rejects.toThrow(
    /not wired to a real model call/
  );
  expect(runtimeRepository.listRuns("osint-agent")[0]).toMatchObject({ status: "failed" });
});

it("retries malformed JSON exactly once, then succeeds on the corrected response", async () => {
  const provider = new RecordingChatProvider("ollama", ["this is not json at all", defaultModelResponse(["seed:username:jdoe"])]);
  const { service } = createRuntime(provider);

  const result = await service.run({ agentId: "osint-agent", seed: { type: "username", value: "jdoe" } });

  expect(provider.calls).toHaveLength(2);
  expect(provider.calls[1]?.userPrompt).toContain("could not be parsed as the required JSON");
  expect(result.finding.title).toBe("Provider-authored lead");
});

it("fails the run when the model is still malformed after its one retry", async () => {
  const provider = new RecordingChatProvider("ollama", ["not json", "still not json"]);
  const { service } = createRuntime(provider);

  await expect(service.run({ agentId: "osint-agent", seed: { type: "username", value: "jdoe" } })).rejects.toThrow(
    /was not valid JSON after one retry/
  );
  expect(provider.calls).toHaveLength(2);
});

it("accepts a JSON response wrapped in a markdown fence, which local models emit despite instructions", async () => {
  const provider = new RecordingChatProvider("ollama", ["```json\n" + defaultModelResponse(["seed:username:jdoe"]) + "\n```"]);
  const { service } = createRuntime(provider);

  const result = await service.run({ agentId: "osint-agent", seed: { type: "username", value: "jdoe" } });

  expect(provider.calls).toHaveLength(1);
  expect(result.finding.title).toBe("Provider-authored lead");
});
