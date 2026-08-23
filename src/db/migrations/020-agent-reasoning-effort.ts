/**
 * Reasoning effort is a per-agent runtime selection, so it lives on the agents
 * row next to provider and model rather than in settings — the agent runtime
 * reads one row to know how to call the provider. Added as a nullable column so
 * existing agents keep the provider default (NULL) until Jack chooses a rung.
 * STRICT tables accept ADD COLUMN; the value is validated in the shared enum and
 * at the handler against provider capability, so a bare TEXT column is safe here.
 */
import type { ReacherDatabase } from "../database.js";

export const migration020AgentReasoningEffort = {
  id: 20,
  name: "agent-reasoning-effort",
  up(db: ReacherDatabase): void {
    db.exec(`
      ALTER TABLE agents ADD COLUMN reasoning_effort TEXT;
    `);
  }
} as const;
