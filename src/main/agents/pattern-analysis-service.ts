/**
 * Pattern analysis is a fourth agent shape, not a variant of AgentRuntimeService,
 * because it is seeded by a whole case rather than one entity -- there is no
 * seed type for "a case," so agentSeedSchema and AgentRunRequest do not fit it.
 * It reuses every proven piece of the OSINT/architect agents rather than
 * inventing parallel storage: findings are ordinary case_items rows (item_type
 * 'pattern_finding', the same save-to-case path every other finding uses), and
 * provenance/shared-memory lives on a real agent_runs row created with a
 * business-typed placeholder seed -- the same trick architect-agent-service.ts
 * uses for a request that is not seed-shaped, so this agent's memory sits in
 * the one shared agent_memory table every other agent reads and writes.
 *
 * Citation integrity works exactly like the OSINT agent's: the citation set is
 * built from the case's own timeline, and any observationId the model returns
 * that is not actually a real case-item id is dropped before it can reach
 * case_items or agent_memory. Unlike a finding, a pattern legitimately can be
 * "there are none" -- a short, unconnected evidence list is a correct answer,
 * not a failure to try harder, so an empty result is never retried.
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { AgentRuntimeRepository } from "../../db/repositories/agent-runtime-repository.js";
import type { AgentsRepository } from "../../db/repositories/agents-repository.js";
import type { AuditRepository } from "../../db/repositories/audit-repository.js";
import type { CasesRepository } from "../../db/repositories/cases-repository.js";
import type { CaseItem } from "../../shared/schemas/cases.js";
import type { PatternFinding, PatternRunResponse } from "../../shared/schemas/pattern-analysis.js";
import { patternFindingSchema } from "../../shared/schemas/pattern-analysis.js";
import { patternTypeValues } from "../../shared/types/pattern-analysis.js";
import { ChatProviderResolver } from "../providers/chat-providers.js";
import { citationArrayField } from "./model-citation-field.js";

const modelPatternSchema = z.object({
  patternType: z.enum(patternTypeValues),
  description: z.string().min(1),
  observationIds: citationArrayField,
  confidence: z.number().int().min(1)
});

// No .min(1) on the top-level array: "this case's evidence connects to
// nothing" is a real, correct answer the model can give, not a malformed one.
const modelOutputSchema = z.object({ patterns: z.array(modelPatternSchema) });

type ModelPattern = z.infer<typeof modelPatternSchema>;

export class PatternAnalysisService {
  public constructor(
    private readonly agentsRepository: AgentsRepository,
    private readonly runtimeRepository: AgentRuntimeRepository,
    private readonly casesRepository: CasesRepository,
    private readonly auditRepository: AuditRepository,
    private readonly repoRoot: string,
    private readonly now = () => new Date(),
    private readonly chatProviders = new ChatProviderResolver()
  ) {}

  public async run(input: { readonly caseId: string }): Promise<PatternRunResponse> {
    const { case: caseRecord, items } = this.casesRepository.get(input.caseId);
    if (!caseRecord) {
      throw new Error(`Case ${input.caseId} does not exist`);
    }

    const agent = this.agentsRepository.get("pattern-agent");
    if (items.length === 0) {
      // Nothing to analyze yet. Calling the model here would give it nothing
      // real to cite, and the only grounded answer to give back is none.
      this.auditRepository.record({
        actor: "local-user",
        action: "pattern.run",
        objectType: "case",
        objectId: input.caseId,
        sensitivity: "medium",
        detail: { findingCount: 0, reason: "case has no evidence yet" }
      });
      return { findings: [] };
    }

    const citations = new Map(items.map((item): [string, string] => [item.id, `${item.title}: ${item.text}`]));
    const provider = this.chatProviders.resolve(agent.provider);
    const systemPrompt = this.readPrompt(agent.promptPath);
    const userPrompt = buildUserPrompt(caseRecord.title, items);

    const first = await provider.complete({ systemPrompt, userPrompt, model: agent.model, effort: agent.reasoningEffort, expectJson: true });
    const firstResult = evaluatePatternResponse(first.text, citations);
    const patternResult = firstResult.ok
      ? firstResult
      : await (async () => {
          const retry = await provider.complete({
            systemPrompt,
            userPrompt: `${userPrompt}\n\n${firstResult.retryHint}`,
            model: agent.model,
            effort: agent.reasoningEffort,
            expectJson: true
          });
          return evaluatePatternResponse(retry.text, citations);
        })();
    if (!patternResult.ok) {
      throw new Error(`${agent.name}'s model response ${patternResult.summary} after one retry`);
    }

    if (patternResult.value.length === 0) {
      this.auditRepository.record({
        actor: "local-user",
        action: "pattern.run",
        objectType: "case",
        objectId: input.caseId,
        sensitivity: "medium",
        detail: { findingCount: 0, provider: agent.provider, model: agent.model }
      });
      return { findings: [] };
    }

    const findings = this.runtimeRepository.atomic(() => {
      const runId = this.ensurePatternRun(input.caseId, agent.provider, agent.model);
      const nowTs = this.now().toISOString();
      const saved: PatternFinding[] = patternResult.value.map((pattern) => {
        const savedItem = this.casesRepository.addItem({
          caseId: input.caseId,
          itemType: "pattern_finding",
          title: patternTitle(pattern.patternType),
          text: pattern.description,
          sourceTs: nowTs,
          metadata: { patternType: pattern.patternType, observationIds: pattern.observationIds, confidence: pattern.confidence }
        });
        this.runtimeRepository.appendMemory({
          scope: "global",
          key: `pattern:${savedItem.id}`,
          value: pattern.description,
          sourceAgent: "pattern-agent",
          citedRun: runId,
          confidence: pattern.confidence,
          ts: nowTs
        });
        return patternFindingSchema.parse({
          id: savedItem.id,
          caseId: input.caseId,
          patternType: pattern.patternType,
          description: pattern.description,
          observationIds: pattern.observationIds,
          confidence: pattern.confidence,
          ts: nowTs
        });
      });
      this.auditRepository.record({
        actor: "local-user",
        action: "pattern.run",
        objectType: "case",
        objectId: input.caseId,
        sensitivity: "medium",
        detail: { findingCount: saved.length, provider: agent.provider, model: agent.model }
      });
      return saved;
    });

    return { findings };
  }

  public list(caseId: string): PatternFinding[] {
    return this.casesRepository
      .timeline(caseId)
      .filter((item) => item.itemType === "pattern_finding")
      .map((item) => toPatternFinding(caseId, item));
  }

  private ensurePatternRun(caseId: string, provider: string, model: string): string {
    const run = this.runtimeRepository.startRun({
      agentId: "pattern-agent",
      caseId,
      provider,
      model,
      seed: { type: "business", value: `case:${caseId}` },
      startedTs: this.now().toISOString()
    });
    this.runtimeRepository.finishRun(run.id, "succeeded", this.now().toISOString());
    return run.id;
  }

  private readPrompt(promptPath: string): string {
    return fs.readFileSync(path.join(this.repoRoot, promptPath), "utf8");
  }
}

function patternTitle(patternType: string): string {
  return `Pattern: ${patternType.replace(/_/g, " ")}`;
}

function toPatternFinding(caseId: string, item: CaseItem): PatternFinding {
  const patternType = typeof item.metadata.patternType === "string" ? item.metadata.patternType : "recurring_identifier";
  const observationIds = Array.isArray(item.metadata.observationIds)
    ? item.metadata.observationIds.filter((value): value is string => typeof value === "string")
    : [];
  const confidence = typeof item.metadata.confidence === "number" ? Math.max(1, Math.round(item.metadata.confidence)) : 1;
  return patternFindingSchema.parse({
    id: item.id,
    caseId,
    patternType,
    description: item.text,
    observationIds: observationIds.length > 0 ? observationIds : [item.id],
    confidence,
    ts: item.sourceTs
  });
}

function buildUserPrompt(caseTitle: string, items: readonly CaseItem[]): string {
  const citationLines = items.map((item) => `- ${item.id} | ${item.title}: ${item.text}`).join("\n");
  return [
    `Case: ${caseTitle}`,
    "",
    'Cited evidence, one per line as "ID | title: text". Put ONLY the exact ID text (everything before the " | ") into every "observationIds" array entry:',
    citationLines,
    "",
    "Respond with ONLY a JSON object, no prose and no markdown code fences, matching exactly this shape. An empty \"patterns\" array is a correct answer when nothing connects:",
    '{"patterns": [{"patternType": "recurring_identifier" | "temporal_cluster" | "geographic_cluster" | "contradiction", "description": string, "observationIds": string[], "confidence": integer >= 1}]}'
  ].join("\n");
}

type PatternEvaluation =
  | { readonly ok: true; readonly value: readonly ModelPattern[] }
  | { readonly ok: false; readonly summary: string; readonly retryHint: string };

/**
 * Grounds every pattern's observationIds against the real citation set and
 * drops a pattern outright once its ids are entirely invented -- the same
 * "kept only if grounded, never trusted empty" rule architect-agent-service.ts
 * applies to plan steps, for the same reason: a pattern schema-required to
 * carry at least one id (modelPatternSchema) that survived filtering with zero
 * real ones would otherwise crash patternFindingSchema's own minimum right
 * after. Only retries when the model reported patterns but every one of them
 * was entirely invented; a response that legitimately reports zero patterns is
 * accepted immediately, not retried.
 */
function evaluatePatternResponse(text: string, citations: ReadonlyMap<string, string>): PatternEvaluation {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return {
      ok: false,
      summary: "was not valid JSON",
      retryHint: "Your previous response could not be parsed as the required JSON shape. Respond again with ONLY the JSON object -- no prose, no markdown fences."
    };
  }

  const modelOutput = modelOutputSchema.safeParse(parsed);
  if (!modelOutput.success) {
    return {
      ok: false,
      summary: "did not match the required pattern shape",
      retryHint: `Your previous response did not match the required shape (${modelOutput.error.issues[0]?.message ?? "invalid"}). Respond again with ONLY the exact JSON shape requested.`
    };
  }

  if (modelOutput.data.patterns.length === 0) {
    return { ok: true, value: [] };
  }

  const grounded = modelOutput.data.patterns
    .map((pattern) => ({ ...pattern, observationIds: pattern.observationIds.filter((id) => citations.has(id)) }))
    .filter((pattern) => pattern.observationIds.length > 0);
  if (grounded.length === 0) {
    const offered = [...new Set(modelOutput.data.patterns.flatMap((pattern) => pattern.observationIds))].join(", ") || "(none)";
    return {
      ok: false,
      summary: `did not cite any of the evidence it was shown (offered: ${offered})`,
      retryHint:
        "None of the ids in your patterns' \"observationIds\" arrays matched the cited evidence list. Every id must be copied exactly from the list -- respond again using only those ids, or an empty \"patterns\" array if nothing actually connects."
    };
  }

  return { ok: true, value: grounded };
}
