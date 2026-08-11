/**
 * Dashboard reads are collected here because the home surface spans cases,
 * searches, agents, and monitoring without owning any of them. If those joins
 * leaked into React components, the renderer would become a second database
 * client and the phase audit could no longer prove read boundaries.
 */
import type { ReacherDatabase } from "../database.js";
import type { CaseRecord } from "../../shared/schemas/cases.js";
import type { DashboardSearchRun } from "../../shared/schemas/dashboard.js";
import type { MonitoringAlert } from "../../shared/schemas/monitoring.js";
import type { AgentRunRecord } from "../../shared/schemas/agents-runtime.js";
import type { SeedType } from "../../shared/types/search.js";
import type { AgentRunStatus } from "../../shared/types/agents-runtime.js";

interface CaseRow {
  readonly id: string;
  readonly title: string;
  readonly status: "open" | "archived";
  readonly created_ts: string;
  readonly updated_ts: string;
}

interface SearchRunRow {
  readonly id: string;
  readonly seed_type: SeedType;
  readonly seed_value: string;
  readonly started_ts: string;
  readonly completed_ts: string | null;
}

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

interface AlertRow {
  readonly id: string;
  readonly exposure_id: string;
  readonly watch_id: string;
  readonly message: string;
  readonly created_ts: string;
  readonly acknowledged_ts: string | null;
}

export class DashboardRepository {
  public constructor(private readonly db: ReacherDatabase) {}

  public activeCases(limit: number): CaseRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM cases WHERE status = 'open' ORDER BY updated_ts DESC, title LIMIT ?")
      .all(limit) as CaseRow[];
    return rows.map((row) => this.toCase(row));
  }

  public recentSearches(limit: number): DashboardSearchRun[] {
    const rows = this.db
      .prepare(
        `SELECT id, seed_type, seed_value, started_ts, completed_ts
         FROM search_runs
         ORDER BY started_ts DESC, id DESC
         LIMIT ?`
      )
      .all(limit) as SearchRunRow[];
    return rows.map((row) => ({
      id: row.id,
      seedType: row.seed_type,
      seedValue: row.seed_value,
      startedTs: row.started_ts,
      completedTs: row.completed_ts
    }));
  }

  public recentAgentRuns(limit: number): AgentRunRecord[] {
    const rows = this.db
      .prepare(
        `SELECT id, agent_id, case_id, provider, model, seed_json, status, started_ts, completed_ts, error
         FROM agent_runs
         ORDER BY started_ts DESC, id DESC
         LIMIT ?`
      )
      .all(limit) as AgentRunRow[];
    return rows.map((row) => ({
      id: row.id,
      agentId: row.agent_id,
      caseId: row.case_id,
      provider: row.provider,
      model: row.model,
      seed: JSON.parse(row.seed_json) as AgentRunRecord["seed"],
      status: row.status,
      startedTs: row.started_ts,
      completedTs: row.completed_ts,
      error: row.error
    }));
  }

  public watchAlerts(limit: number): MonitoringAlert[] {
    const rows = this.db
      .prepare("SELECT * FROM monitoring_alerts ORDER BY created_ts DESC, id DESC LIMIT ?")
      .all(limit) as AlertRow[];
    return rows.map((row) => ({
      id: row.id,
      exposureId: row.exposure_id,
      watchId: row.watch_id,
      message: row.message,
      createdTs: row.created_ts,
      acknowledgedTs: row.acknowledged_ts
    }));
  }

  private toCase(row: CaseRow): CaseRecord {
    const tags = this.db.prepare("SELECT tag FROM case_tags WHERE case_id = ? ORDER BY tag").all(row.id) as { tag: string }[];
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      createdTs: row.created_ts,
      updatedTs: row.updated_ts,
      tags: tags.map((tag) => tag.tag)
    };
  }
}
