/**
 * Every agent shipped pointing at llama3.3, which is a 70B model needing roughly
 * 43GB once quantised. Jack's machine has 31.7GB of RAM and an RTX 4060, so the
 * model could never load -- the agent runtime would have failed on the very first
 * real call regardless of whether Ollama was installed. llama3.1:8b fits in the
 * card's VRAM and answers fast enough to sit behind a search that now starts an
 * agent on every Enter.
 *
 * Matched on the seeded model string, mirroring migrations 021 and 025, so a
 * larger model deliberately chosen in Settings on a beefier machine is never
 * clobbered.
 *
 * The ripper row is a separate case: 'claude-sonnet-4.5' is not a real Anthropic
 * model id. It was inert while the runtime only produced template text, but now
 * that chat-providers.ts makes real calls it would 404 on every run, so it is
 * corrected unconditionally the way migration 019 corrected a placeholder prompt
 * path -- a wrong id is a bug, not a preference.
 */
import type { ReacherDatabase } from "../database.js";

export const migration026RunnableAgentModels = {
  id: 26,
  name: "runnable-agent-models",
  up(db: ReacherDatabase): void {
    db.exec(`
      UPDATE agents
      SET model = 'llama3.1:8b'
      WHERE provider = 'ollama'
        AND model = 'llama3.3';

      UPDATE agents
      SET model = 'claude-sonnet-5'
      WHERE provider = 'anthropic'
        AND model IN ('claude-sonnet-4.5', 'claude-haiku-4.5');
    `);
  }
} as const;
