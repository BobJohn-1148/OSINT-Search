/**
 * Agent selections live in a repository so provider adapters can ask for the
 * current model without reading settings directly. If model choice were spread
 * across UI state, the agent runtime would drift from what Settings displays.
 */
import type { ReacherDatabase } from "../database.js";
import type { AgentRecord } from "../../shared/schemas/agents.js";
import type { ProviderId, ReasoningEffort } from "../../shared/types/providers.js";

interface AgentRow {
  readonly id: string;
  readonly name: string;
  readonly provider: ProviderId;
  readonly model: string;
  readonly prompt_path: string;
  readonly approval_mode: "manual" | "auto";
  readonly reasoning_effort: ReasoningEffort | null;
}

export class AgentsRepository {
  public constructor(private readonly db: ReacherDatabase) {}

  public list(): AgentRecord[] {
    const rows = this.db.prepare("SELECT * FROM agents ORDER BY name").all() as AgentRow[];
    return rows.map((row) => this.toAgent(row));
  }

  public setModel(agentId: string, provider: ProviderId, model: string): AgentRecord {
    const result = this.db.prepare("UPDATE agents SET provider = ?, model = ? WHERE id = ?").run(provider, model, agentId);
    if (result.changes === 0) {
      throw new Error(`Agent ${agentId} does not exist`);
    }

    return this.get(agentId);
  }

  public setReasoningEffort(agentId: string, effort: ReasoningEffort | null): AgentRecord {
    const result = this.db.prepare("UPDATE agents SET reasoning_effort = ? WHERE id = ?").run(effort, agentId);
    if (result.changes === 0) {
      throw new Error(`Agent ${agentId} does not exist`);
    }

    return this.get(agentId);
  }

  public get(agentId: string): AgentRecord {
    const row = this.db.prepare("SELECT * FROM agents WHERE id = ?").get(agentId) as AgentRow | undefined;
    if (!row) {
      throw new Error(`Agent ${agentId} does not exist`);
    }

    return this.toAgent(row);
  }

  private toAgent(row: AgentRow): AgentRecord {
    return {
      id: row.id,
      name: row.name,
      provider: row.provider,
      model: row.model,
      promptPath: row.prompt_path,
      approvalMode: row.approval_mode,
      reasoningEffort: row.reasoning_effort ?? null
    };
  }
}
