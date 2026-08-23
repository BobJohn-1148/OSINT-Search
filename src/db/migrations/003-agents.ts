/**
 * Agents are seeded as local rows because provider and model switching must be
 * durable before any agent runtime exists. If defaults lived only in renderer
 * code, a later provider adapter could run with a different model than the UI
 * displays.
 */
import type { ReacherDatabase } from "../database.js";

export const migration003Agents = {
  id: 3,
  name: "agents",
  up(db: ReacherDatabase): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        prompt_path TEXT NOT NULL,
        approval_mode TEXT NOT NULL CHECK (approval_mode IN ('manual', 'auto'))
      ) STRICT;

      INSERT INTO agents (id, name, provider, model, prompt_path, approval_mode)
      VALUES
        ('osint-agent', 'OSINT agent', 'openai', 'gpt-5.1', 'planning/agent-prompts/osint-agent.md', 'manual'),
        ('architect-agent', 'Architect agent', 'openai', 'gpt-5.1', 'planning/agent-prompts/architect-agent.md', 'manual')
      ON CONFLICT(id) DO NOTHING;
    `);
  }
} as const;
