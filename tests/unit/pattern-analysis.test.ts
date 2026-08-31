/**
 * Pattern-analysis tests use real repositories and a real in-memory case
 * because this agent's whole job is grounding cross-case findings in evidence
 * that actually exists, not generating prose. A fake ChatProvider stands in
 * for the model, mirroring agent-runtime.test.ts's RecordingChatProvider, so
 * the citation-integrity assertions stay deterministic instead of depending on
 * a running Ollama.
 */
import Database from "better-sqlite3";
import { runMigrations } from "../../src/db/migrations/runner";
import { AgentRuntimeRepository } from "../../src/db/repositories/agent-runtime-repository";
import { AgentsRepository } from "../../src/db/repositories/agents-repository";
import { AuditRepository } from "../../src/db/repositories/audit-repository";
import { CasesRepository } from "../../src/db/repositories/cases-repository";
import { PatternAnalysisService } from "../../src/main/agents/pattern-analysis-service";
import {
  ChatProviderResolver,
  type ChatCompletionRequest,
  type ChatCompletionResult,
  type ChatProvider
} from "../../src/main/providers/chat-providers";
import type { ProviderId } from "../../src/shared/types/providers";

/** Echoes a scripted response per call, recording what it was asked -- for tests that need exact control over malformed or ungrounded text. */
class RecordingChatProvider implements ChatProvider {
  public readonly calls: ChatCompletionRequest[] = [];

  public constructor(
    public readonly id: ProviderId = "ollama",
    private readonly responses: string[] = ['{"patterns": []}']
  ) {}

  public complete(request: ChatCompletionRequest): Promise<ChatCompletionResult> {
    this.calls.push(request);
    const text = this.responses[Math.min(this.calls.length - 1, this.responses.length - 1)];
    return Promise.resolve({ text });
  }
}

/** Cites every evidence id it is shown, so a seeded case always produces a grounded pattern regardless of what ids the test set up. */
class CaseCitingChatProvider implements ChatProvider {
  public readonly id: ProviderId = "ollama";
  public readonly calls: ChatCompletionRequest[] = [];

  public complete(request: ChatCompletionRequest): Promise<ChatCompletionResult> {
    this.calls.push(request);
    // Matches buildUserPrompt's "- <id> | <title>: <text>" citation line format.
    const ids = [...request.userPrompt.matchAll(/^- (\S+) \|/gm)].map((match) => match[1]);
    return Promise.resolve({
      text: JSON.stringify({
        patterns: [{ patternType: "recurring_identifier", description: "jdoe appears across saved evidence.", observationIds: ids, confidence: 2 }]
      })
    });
  }
}

function createHarness(provider: ChatProvider = new CaseCitingChatProvider()) {
  const db = new Database(":memory:");
  runMigrations(db);
  const agentsRepository = new AgentsRepository(db);
  const runtimeRepository = new AgentRuntimeRepository(db);
  const casesRepository = new CasesRepository(db);
  const auditRepository = new AuditRepository(db);
  const service = new PatternAnalysisService(
    agentsRepository,
    runtimeRepository,
    casesRepository,
    auditRepository,
    process.cwd(),
    () => new Date("2026-08-25T12:00:00.000Z"),
    new ChatProviderResolver([provider])
  );
  return { agentsRepository, auditRepository, casesRepository, runtimeRepository, service };
}

function seedCaseWithEvidence(casesRepository: CasesRepository): { readonly caseId: string; readonly itemIds: string[] } {
  const created = casesRepository.create("Investigation", []);
  const itemA = casesRepository.addItem({ caseId: created.id, itemType: "observation", title: "Email found", text: "jdoe@example.com seen on site A", metadata: {} });
  const itemB = casesRepository.addItem({ caseId: created.id, itemType: "observation", title: "Username found", text: "jdoe seen on site B", metadata: {} });
  return { caseId: created.id, itemIds: [itemA.id, itemB.id] };
}

it("does not call the model and returns no findings when a case has no evidence yet", async () => {
  const provider = new CaseCitingChatProvider();
  const { casesRepository, service } = createHarness(provider);
  const created = casesRepository.create("Empty case", []);

  const response = await service.run({ caseId: created.id });

  expect(response.findings).toEqual([]);
  expect(provider.calls).toEqual([]);
});

it("throws a clear error for a case that does not exist so a stale caseId cannot silently no-op", async () => {
  const { service } = createHarness();

  await expect(service.run({ caseId: "missing-case" })).rejects.toThrow(/Case missing-case does not exist/);
});

it("persists a grounded pattern as a case item, shared memory entry, and audit event", async () => {
  const { auditRepository, casesRepository, runtimeRepository, service } = createHarness();
  const { caseId, itemIds } = seedCaseWithEvidence(casesRepository);

  const response = await service.run({ caseId });

  expect(response.findings).toHaveLength(1);
  const [finding] = response.findings;
  expect(finding).toMatchObject({
    caseId,
    patternType: "recurring_identifier",
    description: "jdoe appears across saved evidence.",
    confidence: 2
  });
  expect(finding.observationIds.sort()).toEqual([...itemIds].sort());

  const timeline = casesRepository.timeline(caseId);
  expect(timeline.some((item) => item.itemType === "pattern_finding" && item.id === finding.id)).toBe(true);

  expect(runtimeRepository.listMemory("global", 10)[0]).toMatchObject({
    sourceAgent: "pattern-agent",
    value: "jdoe appears across saved evidence."
  });
  expect(auditRepository.list(10)[0]).toMatchObject({ action: "pattern.run" });
});

it("drops an invented observationId from an otherwise-grounded pattern instead of trusting it", async () => {
  const db = new Database(":memory:");
  runMigrations(db);
  const casesRepository = new CasesRepository(db);
  const { caseId, itemIds } = seedCaseWithEvidence(casesRepository);
  const provider = new RecordingChatProvider("ollama", [
    JSON.stringify({
      patterns: [
        { patternType: "recurring_identifier", description: "Partly real.", observationIds: [itemIds[0], "invented-id"], confidence: 3 }
      ]
    })
  ]);
  const service = new PatternAnalysisService(
    new AgentsRepository(db),
    new AgentRuntimeRepository(db),
    casesRepository,
    new AuditRepository(db),
    process.cwd(),
    () => new Date("2026-08-25T12:00:00.000Z"),
    new ChatProviderResolver([provider])
  );

  const response = await service.run({ caseId });

  expect(response.findings).toHaveLength(1);
  expect(response.findings[0].observationIds).toEqual([itemIds[0]]);
});

it("drops a pattern outright when every one of its observationIds is invented, instead of keeping it with none", async () => {
  const provider = new RecordingChatProvider("ollama", [
    JSON.stringify({
      patterns: [
        { patternType: "recurring_identifier", description: "Real.", observationIds: ["also-invented"], confidence: 1 }
      ]
    })
  ]);
  const { casesRepository, service } = createHarness(provider);
  const { caseId } = seedCaseWithEvidence(casesRepository);

  await expect(service.run({ caseId })).rejects.toThrow(/did not cite any of the evidence it was shown/);
});

it("accepts a legitimate empty patterns array immediately without retrying", async () => {
  const provider = new RecordingChatProvider("ollama", ['{"patterns": []}']);
  const { casesRepository, service } = createHarness(provider);
  const { caseId } = seedCaseWithEvidence(casesRepository);

  const response = await service.run({ caseId });

  expect(response.findings).toEqual([]);
  expect(provider.calls).toHaveLength(1);
});

it("retries malformed JSON exactly once then fails the run instead of falling back to fake text", async () => {
  const provider = new RecordingChatProvider("ollama", ["not json at all", "still not json"]);
  const { casesRepository, service } = createHarness(provider);
  const { caseId } = seedCaseWithEvidence(casesRepository);

  await expect(service.run({ caseId })).rejects.toThrow(/was not valid JSON/);
  expect(provider.calls).toHaveLength(2);
});

it("retries once when every reported pattern is entirely ungrounded, then succeeds if the retry is grounded", async () => {
  const db = new Database(":memory:");
  runMigrations(db);
  const casesRepository = new CasesRepository(db);
  const { caseId, itemIds } = seedCaseWithEvidence(casesRepository);
  const provider = new RecordingChatProvider("ollama", [
    JSON.stringify({ patterns: [{ patternType: "contradiction", description: "Bad.", observationIds: ["invented"], confidence: 1 }] }),
    JSON.stringify({ patterns: [{ patternType: "contradiction", description: "Good.", observationIds: [itemIds[0]], confidence: 1 }] })
  ]);
  const service = new PatternAnalysisService(
    new AgentsRepository(db),
    new AgentRuntimeRepository(db),
    casesRepository,
    new AuditRepository(db),
    process.cwd(),
    () => new Date("2026-08-25T12:00:00.000Z"),
    new ChatProviderResolver([provider])
  );

  const response = await service.run({ caseId });

  expect(provider.calls).toHaveLength(2);
  expect(response.findings).toHaveLength(1);
  expect(response.findings[0].description).toBe("Good.");
});

it("lists previously persisted findings reconstructed from the case timeline", async () => {
  const { casesRepository, service } = createHarness();
  const { caseId } = seedCaseWithEvidence(casesRepository);

  const ran = await service.run({ caseId });
  const listed = service.list(caseId);

  expect(listed).toEqual(ran.findings);
});
