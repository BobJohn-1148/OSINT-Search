/**
 * The ripper-agent shipped in migration 009 pointing at the OSINT prompt, so it
 * behaved as an OSINT clone rather than the credential/hash specialist its name
 * and persona promise. Migration 003/009 already ran on Jack's local store and
 * are never replayed, so the fix has to arrive as new numbered history that
 * repoints the existing row. Idempotent: re-running sets the same path.
 */
import type { ReacherDatabase } from "../database.js";

export const migration019RipperAgentPrompt = {
  id: 19,
  name: "ripper-agent-prompt",
  up(db: ReacherDatabase): void {
    db.exec(`
      UPDATE agents
      SET prompt_path = 'planning/agent-prompts/ripper-agent.md'
      WHERE id = 'ripper-agent';
    `);
  }
} as const;
