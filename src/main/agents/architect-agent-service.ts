/**
 * The architect service coordinates provider calls, confirmation, writes, audit,
 * and memory so no single layer can skip the owner gate. If React or the model
 * could apply directly, Codex output could mutate the repo without review.
 */
import { randomUUID } from "node:crypto";
import type { AgentRuntimeRepository } from "../../db/repositories/agent-runtime-repository.js";
import type { AgentsRepository } from "../../db/repositories/agents-repository.js";
import type { AuditRepository } from "../../db/repositories/audit-repository.js";
import type {
  ArchitectApplyResponse,
  ArchitectAskResponse,
  ArchitectProposal,
  ArchitectProposePlanResponse
} from "../../shared/schemas/architect-agent.js";
import { architectProposalSchema } from "../../shared/schemas/architect-agent.js";
import type { ArchitectApplyExecutor } from "./architect-apply-executor.js";
import { PlanArtifactApplyExecutor } from "./architect-apply-executor.js";
import { ArchitectProviderResolver } from "./architect-chat-provider.js";
import { RepoReadTool } from "./repo-read-tool.js";

export type ConfirmArchitectApply = (proposal: ArchitectProposal) => boolean | Promise<boolean>;

export class ArchitectAgentService {
  private readonly proposals = new Map<string, ArchitectProposal>();
  private readonly repoReadTool: RepoReadTool | null;

  public constructor(
    private readonly agentsRepository: AgentsRepository,
    private readonly runtimeRepository: AgentRuntimeRepository,
    private readonly auditRepository: AuditRepository,
    repoRoot: string,
    private readonly confirmApply: ConfirmArchitectApply,
    private readonly providerResolver = new ArchitectProviderResolver(),
    private readonly applyExecutor: ArchitectApplyExecutor = new PlanArtifactApplyExecutor(repoRoot),
    private readonly now = () => new Date()
  ) {
    this.repoReadTool = this.createRepoReadTool(repoRoot);
  }

  public ask(input: { readonly question: string; readonly files: readonly string[] }): ArchitectAskResponse {
    const repoReadTool = this.requireRepoReadTool();
    const agent = this.agentsRepository.get("architect-agent");
    const citations = repoReadTool.readContext(input.files);
    const memory = this.runtimeRepository.listMemory(undefined, 50);
    const provider = this.providerResolver.resolve(agent.provider);
    const answer = provider.ask({
      provider: agent.provider,
      model: agent.model,
      prompt: repoReadTool.readText(agent.promptPath),
      citations,
      memory: memory.map((item) => `${item.key}: ${item.value}`),
      question: input.question
    });
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

  public proposePlan(input: { readonly request: string; readonly files: readonly string[] }): ArchitectProposePlanResponse {
    const repoReadTool = this.requireRepoReadTool();
    const agent = this.agentsRepository.get("architect-agent");
    const citations = repoReadTool.readContext(input.files);
    const memory = this.runtimeRepository.listMemory(undefined, 50);
    const provider = this.providerResolver.resolve(agent.provider);
    const providerPlan = provider.proposePlan({
      provider: agent.provider,
      model: agent.model,
      prompt: repoReadTool.readText(agent.promptPath),
      citations,
      memory: memory.map((item) => `${item.key}: ${item.value}`),
      request: input.request
    });
    const proposal = architectProposalSchema.parse({
      id: randomUUID(),
      agentId: "architect-agent",
      request: input.request,
      summary: providerPlan.summary,
      steps: providerPlan.steps,
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
