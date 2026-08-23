/**
 * Agent runtime persistence stays in one repository so streaming, memory, and
 * history share one SQL boundary. If the runtime wrote rows directly, later
 * providers could bypass the cited-memory invariant.
 */
import { randomUUID } from "node:crypto";
import type { ReacherDatabase } from "../database.js";
import type {
  AgentLiveState,
  AgentMemoryRecord,
  AgentPlaybook,
  AgentRunRecord,
  AgentStep
} from "../../shared/schemas/agents-runtime.js";
import type { AgentRunStatus, AgentSeed } from "../../shared/types/agents-runtime.js";

interface AgentRunRow {
  readonly id: string;
  readonly agent_id: string;
  readonly case_id: string | null;
  readonly provider: string;
  readonly model: string;
  readonly seed_json: string;
  readonly status: AgentRunStatus;
  readonly started_ts: string;
  readonly completed_ts: string | null;
  readonly error: string | null;
}

interface AgentStepRow {
  readonly id: string;
  readonly run_id: string;
  readonly agent_id: string;
  readonly sequence: number;
  readonly title: string;
  readonly status: "queued" | "running" | "complete" | "error";
  readonly summary: string | null;
  readonly next: string | null;
  readonly sources_json: string;
  readonly ts: string;
}

interface AgentMemoryRow {
  readonly id: string;
  readonly scope: string;
  readonly key: string;
  readonly value: string;
  readonly source_agent: string;
  readonly cited_run: string;
  readonly confidence: number;
  readonly ts: string;
}

interface AgentPlaybookRow {
  readonly id: string;
  readonly title: string;
  readonly agent_id: string;
  readonly cadence: "hourly" | "daily" | "nightly" | "weekly" | "continuous";
  readonly active: 0 | 1;
  readonly next_run_ts: string;
}

export class AgentRuntimeRepository {
  public constructor(private readonly db: ReacherDatabase) {}

  public atomic<T>(work: () => T): T {
    return this.db.transaction(work)();
  }

  public startRun(input: {
    readonly agentId: string;
    readonly caseId?: string | null;
    readonly provider: string;
    readonly model: string;
    readonly seed: AgentSeed;
    readonly startedTs: string;
  }): AgentRunRecord {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO agent_runs (id, agent_id, case_id, provider, model, seed_json, status, started_ts)
         VALUES (?, ?, ?, ?, ?, ?, 'running', ?)`
      )
      .run(id, input.agentId, input.caseId ?? null, input.provider, input.model, JSON.stringify(input.seed), input.startedTs);
    return this.getRun(id) ?? this.missingRun(id);
  }

  public finishRun(runId: string, status: "succeeded" | "failed", completedTs: string, error?: string | null): AgentRunRecord {
    this.db
      .prepare("UPDATE agent_runs SET status = ?, completed_ts = ?, error = ? WHERE id = ?")
      .run(status, completedTs, error ?? null, runId);
    return this.getRun(runId) ?? this.missingRun(runId);
  }

  public appendStep(step: AgentStep, ts: string): AgentStep {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO agent_steps (id, run_id, agent_id, sequence, title, status, summary, next, sources_json, ts)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        step.runId,
        step.agentId,
        step.sequence,
        step.title,
        step.status,
        step.summary,
        step.next,
        JSON.stringify(step.sources),
        ts
      );
    return step;
  }

  public appendMemory(input: {
    readonly scope: string;
    readonly key: string;
    readonly value: string;
    readonly sourceAgent: string;
    readonly citedRun: string;
    readonly confidence: number;
    readonly ts: string;
  }): AgentMemoryRecord {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO agent_memory (id, scope, key, value, source_agent, cited_run, confidence, ts)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, input.scope, input.key, input.value, input.sourceAgent, input.citedRun, input.confidence, input.ts);
    return {
      id,
      scope: input.scope,
      key: input.key,
      value: input.value,
      sourceAgent: input.sourceAgent,
      citedRun: input.citedRun,
      confidence: input.confidence,
      ts: input.ts
    };
  }

  public listRuns(agentId?: string): AgentRunRecord[] {
    const rows = agentId
      ? this.db.prepare("SELECT * FROM agent_runs WHERE agent_id = ? ORDER BY started_ts DESC, id DESC").all(agentId)
      : this.db.prepare("SELECT * FROM agent_runs ORDER BY started_ts DESC, id DESC").all();
    return (rows as AgentRunRow[]).map((row) => this.toRun(row));
  }

  public listMemory(scope: string | undefined, limit: number): AgentMemoryRecord[] {
    const rows = scope
      ? this.db
          .prepare("SELECT * FROM agent_memory WHERE scope = ? ORDER BY ts DESC, id DESC LIMIT ?")
          .all(scope, limit)
      : this.db.prepare("SELECT * FROM agent_memory ORDER BY ts DESC, id DESC LIMIT ?").all(limit);
    return (rows as AgentMemoryRow[]).map((row) => this.toMemory(row));
  }

  public listSteps(runId: string): AgentStep[] {
    const rows = this.db
      .prepare("SELECT * FROM agent_steps WHERE run_id = ? ORDER BY sequence ASC")
      .all(runId) as AgentStepRow[];
    return rows.map((row) => this.toStep(row));
  }

  public listPlaybooks(): AgentPlaybook[] {
    const rows = this.db.prepare("SELECT * FROM agent_playbooks ORDER BY next_run_ts ASC, title").all() as AgentPlaybookRow[];
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      agentId: row.agent_id,
      cadence: row.cadence,
      active: row.active === 1,
      nextRunTs: row.next_run_ts
    }));
  }

  public currentStates(agentIds: readonly string[], nowTs: string): AgentLiveState[] {
    return agentIds.map((agentId) => {
      const row = this.db
        .prepare("SELECT * FROM agent_runs WHERE agent_id = ? ORDER BY started_ts DESC, id DESC LIMIT 1")
        .get(agentId) as AgentRunRow | undefined;
      if (row?.status === "running" || row?.status === "queued") {
        return { agentId, status: "working", task: taskFromSeed(JSON.parse(row.seed_json) as AgentSeed), lastRunId: row.id, updatedTs: nowTs };
      }
      if (row?.status === "failed") {
        return { agentId, status: "error", task: row.error ?? "spat out a stack trace", lastRunId: row.id, updatedTs: nowTs };
      }
      return { agentId, status: "idle", task: null, lastRunId: row?.id ?? null, updatedTs: nowTs };
    });
  }

  private getRun(runId: string): AgentRunRecord | null {
    const row = this.db.prepare("SELECT * FROM agent_runs WHERE id = ?").get(runId) as AgentRunRow | undefined;
    return row ? this.toRun(row) : null;
  }

  private toRun(row: AgentRunRow): AgentRunRecord {
    return {
      id: row.id,
      agentId: row.agent_id,
      caseId: row.case_id,
      provider: row.provider,
      model: row.model,
      seed: JSON.parse(row.seed_json) as AgentSeed,
      status: row.status,
      startedTs: row.started_ts,
      completedTs: row.completed_ts,
      error: row.error
    };
  }

  private toStep(row: AgentStepRow): AgentStep {
    return {
      runId: row.run_id,
      agentId: row.agent_id,
      sequence: row.sequence,
      title: row.title,
      status: row.status,
      summary: row.summary,
      next: row.next,
      sources: JSON.parse(row.sources_json) as string[]
    };
  }

  private toMemory(row: AgentMemoryRow): AgentMemoryRecord {
    return {
      id: row.id,
      scope: row.scope,
      key: row.key,
      value: row.value,
      sourceAgent: row.source_agent,
      citedRun: row.cited_run,
      confidence: row.confidence,
      ts: row.ts
    };
  }

  private missingRun(runId: string): never {
    throw new Error(`Agent run ${runId} was not persisted`);
  }
}

function taskFromSeed(seed: AgentSeed): string {
  return `running Sherlock on ${seed.value}`;
}
