/**
 * architect-agent seeded pointing at provider 'openai' model 'codex' -- inert
 * while ArchitectProviderResolver only produced template text (Codex isn't a
 * real chat-providers.ts model call target), so it never failed. Now that
 * architect-agent-service.ts calls a real model through the same
 * ChatProviderResolver the OSINT runtime agents use, 'openai' resolves to
 * UnavailableChatProvider and every ask/proposePlan call would fail loudly on
 * the very first real use. Moved straight to 'llama3.1:8b' (not 'llama3.3',
 * which migration 026 already found does not fit Jack's actual hardware) so
 * the agent is runnable zero-cost out of the box; Anthropic/xAI stay
 * selectable in Settings for anyone who wants a stronger model for planning.
 *
 * Matched on the seeded provider, mirroring migrations 021, 025, and 026, so
 * a provider Jack already deliberately chose in Settings is never clobbered.
 */
import type { ReacherDatabase } from "../database.js";

export const migration027ArchitectAgentRunnableDefault = {
  id: 27,
  name: "architect-agent-runnable-default",
  up(db: ReacherDatabase): void {
    db.exec(`
      UPDATE agents
      SET provider = 'ollama', model = 'llama3.1:8b'
      WHERE id = 'architect-agent'
        AND provider = 'openai';
    `);
  }
} as const;
