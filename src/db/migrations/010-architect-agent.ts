/**
 * The architect default lands in a migration because provider choice is durable
 * agent state, not renderer preference. If the Codex default lived only in UI
 * copy, Settings and the main-process runtime could disagree about the model.
 */
import type { ReacherDatabase } from "../database.js";

export const migration010ArchitectAgent = {
  id: 10,
  name: "architect-agent",
  up(db: ReacherDatabase): void {
    db.exec(`
      UPDATE agents
      SET provider = 'openai', model = 'codex'
      WHERE id = 'architect-agent' AND provider = 'openai';
    `);
  }
} as const;
