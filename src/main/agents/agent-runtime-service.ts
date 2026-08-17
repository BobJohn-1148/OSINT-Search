/**
 * The agent runtime is deterministic in Phase 5 because provider adapters are
 * already configurable but real long-running model/tool loops arrive later. This
 * still exercises the correct main-process queue, cited finding gate, case save,
 * memory write, history, and batched event path without letting 3D code run work.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { AgentRuntimeRepository } from "../../db/repositories/agent-runtime-repository.js";
import type { AgentsRepository } from "../../db/repositories/agents-repository.js";
import type { AuditRepository } from "../../db/repositories/audit-repository.js";
import type { CasesRepository } from "../../db/repositories/cases-repository.js";
import type {
  AgentFinding,
  AgentLiveState,
  AgentRuntimeEvent,
  AgentRunRecord,
  AgentStep
} from "../../shared/schemas/agents-runtime.js";
import { agentFindingSchema, STEP_FORMAT } from "../../shared/schemas/agents-runtime.js";
import type { AgentSeed } from "../../shared/types/agents-runtime.js";
import { AgentEventBatcher } from "./agent-event-batcher.js";

export class AgentRuntimeService {
  private queue: Promise<unknown> = Promise.resolve();

  public constructor(
    private readonly agentsRepository: AgentsRepository,
    private readonly runtimeRepository: AgentRuntimeRepository,
    private readonly casesRepository: CasesRepository,
    private readonly auditRepository: AuditRepository,
    private readonly emitBatch: (events: readonly AgentRuntimeEvent[]) => void,
    private readonly repoRoot: string,
    private readonly now = () => new Date()
  ) {}

  public async run(input: {
    readonly agentId: string;
    readonly seed: AgentSeed;
    readonly caseId?: string;
    readonly missionBrief?: string;
  }): Promise<{
    readonly run: AgentRunRecord;
    readonly finding: AgentFinding;
  }> {
    const work = this.queue.then(() => this.execute(input));
    this.queue = work.catch(() => undefined);
    return work;
  }

  public states(): AgentLiveState[] {
    const nowTs = this.now().toISOString();
    return this.runtimeRepository.currentStates(this.agentsRepository.list().map((agent) => agent.id), nowTs);
  }

  private execute(input: {
    readonly agentId: string;
    readonly seed: AgentSeed;
    readonly caseId?: string;
    readonly missionBrief?: string;
  }) {
    const agent = this.agentsRepository.get(input.agentId);
    const prompt = this.readPrompt(agent.promptPath);
    const batcher = new AgentEventBatcher(this.emitBatch);
    const startedTs = this.now().toISOString();
    const caseId = input.caseId ?? this.casesRepository.create(defaultAgentCaseTitle(input.seed), ["agents"]).id;
    const run = this.runtimeRepository.startRun({
      agentId: agent.id,
      caseId,
      provider: agent.provider,
      model: agent.model,
      seed: input.seed,
      startedTs
    });
    try {
      const state: AgentLiveState = {
        agentId: agent.id,
        status: "working",
        task: input.missionBrief ? `brief: ${input.missionBrief.slice(0, 80)}` : `running Sherlock on ${input.seed.value}`,
        lastRunId: run.id,
        updatedTs: startedTs
      };
      batcher.push({ type: "agent:state", state });

      const memoryCount = this.runtimeRepository.listMemory(undefined, 50).length;
      for (const step of this.buildSteps(run.id, agent.id, input.seed, prompt, memoryCount, input.missionBrief)) {
        const parsed = STEP_FORMAT.parse(step);
        this.runtimeRepository.appendStep(parsed, this.now().toISOString());
        batcher.push({ type: "agent:step", step: parsed });
      }

      const finding = this.createCitedFinding(run.id, agent.id, input.seed, caseId, input.missionBrief);
      const result = this.runtimeRepository.atomic(() => {
        const savedItem = this.casesRepository.addItem({
          caseId,
          itemType: "agent_run",
          refId: finding.id,
          title: finding.title,
          text: finding.summary,
          sourceTs: this.now().toISOString(),
          metadata: {
            entity: input.seed.value,
            strength: finding.confidence,
            sources: finding.sources,
            missionBrief: input.missionBrief ?? null
          }
        });
        const savedFinding = agentFindingSchema.parse({ ...finding, savedItemId: savedItem.id });
        this.runtimeRepository.appendMemory({
          scope: "global",
          key: `${input.seed.type}:${input.seed.value}`,
          value: savedFinding.summary,
          sourceAgent: agent.id,
          citedRun: run.id,
          confidence: savedFinding.confidence,
          ts: this.now().toISOString()
        });
        const finished = this.runtimeRepository.finishRun(run.id, "succeeded", this.now().toISOString());
        this.auditRepository.record({
          actor: "local-user",
          action: "agent.run",
          objectType: "agent_run",
          objectId: run.id,
          sensitivity: "medium",
          detail: { agentId: agent.id, seedType: input.seed.type, savedItemId: savedItem.id, missionBrief: input.missionBrief ?? null }
        });
        return { savedFinding, finished };
      });
      const { savedFinding, finished } = result;
      batcher.push({ type: "agent:finding", finding: savedFinding });
      batcher.push({
        type: "agent:state",
        state: { agentId: agent.id, status: "idle", task: null, lastRunId: run.id, updatedTs: finished.completedTs ?? startedTs }
      });
      batcher.flush();
      return { run: finished, finding: savedFinding };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Agent run failed";
      const failed = this.runtimeRepository.finishRun(run.id, "failed", this.now().toISOString(), message);
      batcher.push({
        type: "agent:state",
        state: { agentId: agent.id, status: "error", task: message, lastRunId: run.id, updatedTs: failed.completedTs ?? startedTs }
      });
      batcher.flush();
      this.auditRepository.record({
        actor: "local-user",
        action: "agent.run.failed",
        objectType: "agent_run",
        objectId: run.id,
        sensitivity: "medium",
        detail: { agentId: agent.id, seedType: input.seed.type, error: message }
      });
      throw error;
    }
  }

  private buildSteps(
    runId: string,
    agentId: string,
    seed: AgentSeed,
    prompt: string,
    memoryCount: number,
    missionBrief?: string
  ): AgentStep[] {
    return [
      {
        runId,
        agentId,
        sequence: 1,
        title: "Load prompt and memory",
        status: "complete",
        summary: `Loaded ${prompt.length} prompt characters, ${memoryCount} memory rows${missionBrief ? ", and one mission brief" : ""}.`,
        next: "Normalize seed",
        sources: ["planning/agent-prompts/osint-agent.md"]
      },
      {
        runId,
        agentId,
        sequence: 2,
        title: "Normalize seed",
        status: "complete",
        summary: `${seed.type}:${seed.value}`,
        next: "Cite passive source",
        sources: [`seed:${seed.type}`]
      },
      {
        runId,
        agentId,
        sequence: 3,
        title: missionBrief ? "Apply mission brief" : "Create cited finding",
        status: "complete",
        summary: missionBrief ?? `Prepared a cited finding for ${seed.value}.`,
        next: null,
        sources: [`passive:${seed.type}:${seed.value}`]
      }
    ];
  }

  private createCitedFinding(
    runId: string,
    agentId: string,
    seed: AgentSeed,
    caseId: string | null,
    missionBrief?: string
  ): AgentFinding {
    const briefSummary = missionBrief ? ` Mission brief: ${missionBrief}` : "";
    return agentFindingSchema.parse({
      id: randomUUID(),
      runId,
      agentId,
      caseId,
      title: `OSINT lead for ${seed.value}`,
      summary: `${seed.value} is ready for passive correlation from ${seed.type} sources.${briefSummary}`,
      sources: [`passive:${seed.type}:${seed.value}`],
      confidence: 1,
      savedItemId: null
    });
  }

  private readPrompt(promptPath: string): string {
    return fs.readFileSync(path.join(this.repoRoot, promptPath), "utf8");
  }
}

export function defaultAgentCaseTitle(seed: AgentSeed): string {
  const normalizedValue = seed.value.trim();
  const safeValue = looksLikeInstructionText(normalizedValue) ? "" : normalizedValue.slice(0, 80);
  return safeValue ? `Agent findings: ${seed.type} ${safeValue}` : `Agent findings: ${seed.type}`;
}

function looksLikeInstructionText(value: string): boolean {
  return value.length > 80 || /\b(?:mission brief|cite sources|save only|evidence-backed|follow the|find public evidence)\b/i.test(value);
}
