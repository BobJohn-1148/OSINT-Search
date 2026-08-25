/**
 * The architect service coordinates provider calls, confirmation, writes, audit,
 * and memory so no single layer can skip the owner gate. If React or the model
 * could apply directly, Codex output could mutate the repo without review.
 *
 * ask() and proposePlan() call a real model through the same ChatProviderResolver
 * the OSINT runtime agents use (chat-providers.ts), not a second parallel
 * provider system. Before this, CodexArchitectProvider/TemplateArchitectProvider
 * built their output by string interpolation -- the exact bug the OSINT agents
 * were rewritten to fix earlier, just never applied here because this agent
 * reasons about code changes instead of investigation seeds. A plan's proposed
 * files are filtered against what was actually cited, the same grounding
 * discipline agent-runtime-service.ts enforces for OSINT findings: an architect
 * that invents a file path it was never shown is exactly as wrong as an OSINT
 * agent that invents a source.
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AgentRuntimeRepository } from "../../db/repositories/agent-runtime-repository.js";
import type { AgentsRepository } from "../../db/repositories/agents-repository.js";
import type { AuditRepository } from "../../db/repositories/audit-repository.js";
import type {
  ArchitectApplyResponse,
  ArchitectAskResponse,
  ArchitectProposal,
  ArchitectProposePlanResponse,
  RepoCitation
} from "../../shared/schemas/architect-agent.js";
import { architectProposalSchema } from "../../shared/schemas/architect-agent.js";
import type { AgentMemoryRecord } from "../../shared/schemas/agents-runtime.js";
import { ChatProviderResolver } from "../providers/chat-providers.js";
import type { ArchitectApplyExecutor } from "./architect-apply-executor.js";
import { PlanArtifactApplyExecutor } from "./architect-apply-executor.js";
import { RepoReadTool } from "./repo-read-tool.js";

export type ConfirmArchitectApply = (proposal: ArchitectProposal) => boolean | Promise<boolean>;

const MEMORY_CONTEXT_LIMIT = 50;

const modelPlanStepSchema = z.object({
  title: z.string().min(1),
  files: z.array(z.string().min(1)).default([]),
  reason: z.string().min(1)
});

const modelPlanSchema = z.object({
  summary: z.string().min(1),
  steps: z.array(modelPlanStepSchema).min(1)
});

export class ArchitectAgentService {
  private readonly proposals = new Map<string, ArchitectProposal>();
  private readonly repoReadTool: RepoReadTool | null;

  public constructor(
    private readonly agentsRepository: AgentsRepository,
    private readonly runtimeRepository: AgentRuntimeRepository,
    private readonly auditRepository: AuditRepository,
    repoRoot: string,
    private readonly confirmApply: ConfirmArchitectApply,
    private readonly providerResolver = new ChatProviderResolver(),
    private readonly applyExecutor: ArchitectApplyExecutor = new PlanArtifactApplyExecutor(repoRoot),
    private readonly now = () => new Date()
  ) {
    this.repoReadTool = this.createRepoReadTool(repoRoot);
  }

  public async ask(input: { readonly question: string; readonly files: readonly string[] }): Promise<ArchitectAskResponse> {
    const repoReadTool = this.requireRepoReadTool();
    const agent = this.agentsRepository.get("architect-agent");
    const citations = repoReadTool.readContext(input.files);
    const memory = this.runtimeRepository.listMemory(undefined, MEMORY_CONTEXT_LIMIT);
    const provider = this.providerResolver.resolve(agent.provider);
    const systemPrompt = repoReadTool.readText(agent.promptPath);
    const userPrompt = buildAskPrompt(input.question, citations, memory);

    const response = await provider.complete({ systemPrompt, userPrompt, model: agent.model, effort: agent.reasoningEffort, expectJson: false });
    const answer = response.text.trim();
    if (answer.length === 0) {
      throw new Error(`${agent.name}'s model returned an empty answer`);
    }

    this.auditRepository.record({
      actor: "local-user",
      action: "agent.architect.ask",
      objectType: "agent",
      objectId: agent.id,
      sensitivity: "medium",
      detail: { question: input.question, files: citations.map((citation) => citation.file), provider: agent.provider, model: agent.model }
    });
    return { answer, citations, provider: agent.provider, model: agent.model, memoryCount: memory.length };
  }

  public async proposePlan(input: { readonly request: string; readonly files: readonly string[] }): Promise<ArchitectProposePlanResponse> {
    const repoReadTool = this.requireRepoReadTool();
    const agent = this.agentsRepository.get("architect-agent");
    const citations = repoReadTool.readContext(input.files);
    const memory = this.runtimeRepository.listMemory(undefined, MEMORY_CONTEXT_LIMIT);
    const provider = this.providerResolver.resolve(agent.provider);
    const systemPrompt = repoReadTool.readText(agent.promptPath);
    const userPrompt = buildPlanPrompt(input.request, citations, memory);

    const first = await provider.complete({ systemPrompt, userPrompt, model: agent.model, effort: agent.reasoningEffort, expectJson: true });
    const firstResult = evaluatePlanResponse(first.text, citations);
    const planResult = firstResult.ok
      ? firstResult
      : await (async () => {
          // One retry with the specific problem fed back, mirroring
          // agent-runtime-service.ts's evaluateModelResponse -- a dropped
          // brace or a file path the model invented are both common,
          // cheap-to-correct local-model mistakes.
          const retry = await provider.complete({
            systemPrompt,
            userPrompt: `${userPrompt}\n\n${firstResult.retryHint}`,
            model: agent.model,
            effort: agent.reasoningEffort,
            expectJson: true
          });
          return evaluatePlanResponse(retry.text, citations);
        })();
    if (!planResult.ok) {
      throw new Error(`${agent.name}'s model response ${planResult.summary} after one retry`);
    }

    const proposal = architectProposalSchema.parse({
      id: randomUUID(),
      agentId: "architect-agent",
      request: input.request,
      summary: planResult.value.summary,
      steps: planResult.value.steps,
      citations,
      provider: agent.provider,
      model: agent.model,
      createdTs: this.now().toISOString()
    });
    this.proposals.set(proposal.id, proposal);
    this.auditRepository.record({
      actor: "local-user",
      action: "agent.architect.proposePlan",
      objectType: "agent_plan",
      objectId: proposal.id,
      sensitivity: "medium",
      detail: { request: input.request, files: citations.map((citation) => citation.file), provider: agent.provider, model: agent.model }
    });
    return { proposal, memoryCount: memory.length };
  }

  public async apply(input: { readonly proposalId: string }): Promise<ArchitectApplyResponse> {
    const proposal = this.proposals.get(input.proposalId);
    if (!proposal) {
      throw new Error(`Architect proposal ${input.proposalId} is not available`);
    }
    const confirmed = await this.confirmApply(proposal);
    if (!confirmed) {
      this.auditRepository.record({
        actor: "local-user",
        action: "agent.architect.apply.cancelled",
        objectType: "agent_plan",
        objectId: proposal.id,
        sensitivity: "medium",
        detail: { confirmed, request: proposal.request, provider: proposal.provider, model: proposal.model }
      });
      return { proposalId: proposal.id, applied: false, memoryKey: null, changedFiles: [], audited: true };
    }

    const memoryKey = `architect.plan:${proposal.id}`;
    const changedFiles = this.applyExecutor.plan(proposal);
    this.runtimeRepository.atomic(() => {
      this.auditRepository.record({
        actor: "local-user",
        action: "agent.architect.apply.approved",
        objectType: "agent_plan",
        objectId: proposal.id,
        sensitivity: "medium",
        detail: { confirmed, request: proposal.request, provider: proposal.provider, model: proposal.model, changedFiles }
      });
    });
    this.applyExecutor.apply(proposal);
    this.runtimeRepository.atomic(() => {
      const runId = this.ensureArchitectRun(proposal);
      this.runtimeRepository.appendMemory({
        scope: "global",
        key: memoryKey,
        value: proposal.summary,
        sourceAgent: "architect-agent",
        citedRun: runId,
        confidence: 1,
        ts: this.now().toISOString()
      });
      this.auditRepository.record({
        actor: "local-user",
        action: "agent.architect.apply",
        objectType: "agent_plan",
        objectId: proposal.id,
        sensitivity: "medium",
        detail: { confirmed, request: proposal.request, provider: proposal.provider, model: proposal.model, changedFiles }
      });
    });
    return { proposalId: proposal.id, applied: true, memoryKey, changedFiles: [...changedFiles], audited: true };
  }

  private createRepoReadTool(repoRoot: string): RepoReadTool | null {
    try {
      return new RepoReadTool(repoRoot);
    } catch (error) {
      if (error instanceof Error && error.message === "Architect repo root must contain CLAUDE.md") {
        return null;
      }
      throw error;
    }
  }

  private requireRepoReadTool(): RepoReadTool {
    if (!this.repoReadTool) {
      throw new Error("Architect agent requires a Reacher source checkout with CLAUDE.md");
    }
    return this.repoReadTool;
  }

  private ensureArchitectRun(proposal: ArchitectProposal): string {
    const run = this.runtimeRepository.startRun({
      agentId: "architect-agent",
      provider: proposal.provider,
      model: proposal.model,
      seed: { type: "business", value: proposal.request },
      startedTs: this.now().toISOString()
    });
    this.runtimeRepository.finishRun(run.id, "succeeded", this.now().toISOString());
    return run.id;
  }
}

function buildAskPrompt(question: string, citations: readonly RepoCitation[], memory: readonly AgentMemoryRecord[]): string {
  return [
    `Question: ${question}`,
    "",
    "Cited files (the only source material you may reason from):",
    citations.map((citation) => `- ${citation.file}: ${citation.excerpt}`).join("\n") || "(none)",
    "",
    "Shared memory from earlier architect decisions:",
    memory.map((row) => `- ${row.key}: ${row.value}`).join("\n") || "(none)",
    "",
    "Answer the question directly and plainly, grounded only in the cited files and memory above. Plain text, no JSON, no markdown code fences."
  ].join("\n");
}

function buildPlanPrompt(request: string, citations: readonly RepoCitation[], memory: readonly AgentMemoryRecord[]): string {
  return [
    `Request: ${request}`,
    "",
    "Cited files (every file path in your plan's \"files\" arrays must be copied exactly from this list -- never invent a path):",
    citations.map((citation) => `- ${citation.file}: ${citation.excerpt}`).join("\n") || "(none)",
    "",
    "Shared memory from earlier architect decisions:",
    memory.map((row) => `- ${row.key}: ${row.value}`).join("\n") || "(none)",
    "",
    "Respond with ONLY a JSON object, no prose and no markdown code fences, matching exactly this shape:",
    '{"summary": string, "steps": [{"title": string, "files": string[], "reason": string}]}'
  ].join("\n");
}

type PlanEvaluation =
  | { readonly ok: true; readonly value: z.infer<typeof modelPlanSchema> }
  | { readonly ok: false; readonly summary: string; readonly retryHint: string };

/**
 * Parses the model's plan JSON and grounds every step's file list against
 * what was actually cited -- a step whose files were all invented is dropped
 * outright rather than kept with an empty files array, the same "ungrounded
 * citation gets dropped, not trusted" rule agent-runtime-service.ts applies to
 * OSINT findings. A step surviving with a filtered-but-empty files array would
 * fail architectProposalSchema's own per-step minimum later (confirmed live:
 * a real Ollama plan produced a mix of grounded and ungrounded steps, and the
 * ungrounded ones crashed proposePlan on the schema parse instead of being
 * silently dropped). If every step ends up ungrounded, the whole response is
 * treated as ungrounded and retried once.
 */
function evaluatePlanResponse(text: string, citations: readonly RepoCitation[]): PlanEvaluation {
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
      retryHint: `Your previous response could not be parsed as the required JSON shape. Respond again with ONLY the JSON object -- no prose, no markdown fences.`
    };
  }

  const modelPlan = modelPlanSchema.safeParse(parsed);
  if (!modelPlan.success) {
    return {
      ok: false,
      summary: "did not match the required plan shape",
      retryHint: `Your previous response did not match the required shape (${modelPlan.error.issues[0]?.message ?? "invalid"}). Respond again with ONLY the exact JSON shape requested.`
    };
  }

  const citedFiles = new Set(citations.map((citation) => citation.file));
  const groundedSteps = modelPlan.data.steps
    .map((step) => ({ ...step, files: step.files.filter((file) => citedFiles.has(file)) }))
    .filter((step) => step.files.length > 0);
  if (groundedSteps.length === 0) {
    const offered = [...new Set(modelPlan.data.steps.flatMap((step) => step.files))].join(", ") || "(none)";
    return {
      ok: false,
      summary: `did not cite any of the files it was shown (offered: ${offered})`,
      retryHint:
        "None of the files in your plan's \"files\" arrays matched the cited files list. Every path must be copied exactly from the cited files -- respond again using only those paths."
    };
  }

  return { ok: true, value: { summary: modelPlan.data.summary, steps: groundedSteps } };
}
