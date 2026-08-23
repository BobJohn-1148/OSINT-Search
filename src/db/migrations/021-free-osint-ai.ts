/**
 * The investigation agents shipped defaulting to OpenAI, which needs a paid key.
 * Jack asked for the OSINT to be powered by a free AI, so this repoints the
 * OSINT/Ripper/malware agents onto the local Ollama runtime (no key, no cost).
 * Architect is left on its coding model — it is a developer tool, a separate
 * concern from the OSINT flow.
 *
 * Matched on `provider = 'openai'` (the seeded default), mirroring migration 010,
 * so a deliberate non-default choice Jack already made is never clobbered, and
 * re-running is a no-op. Model/provider stay switchable per agent in Settings and
 * the agents view, so this is a free-by-default, not free-only, stance.
 */
import type { ReacherDatabase } from "../database.js";

export const migration021FreeOsintAi = {
  id: 21,
  name: "free-osint-ai",
  up(db: ReacherDatabase): void {
    db.exec(`
      UPDATE agents
      SET provider = 'ollama', model = 'llama3.3'
      WHERE id IN ('osint-agent', 'ripper-agent', 'malware-analyst-agent')
        AND provider = 'openai';
    `);
  }
} as const;
