/**
 * Migration 021 moved the OSINT/Ripper/malware agents onto free local Ollama but
 * missed scout-agent and byte-agent, and migration 009 seeded both of those
 * pointing at the OSINT prompt as a placeholder. Both gaps only became visible
 * once agent runs started actually reaching a model: an agent on `openai` now
 * fails loudly instead of quietly emitting template text, and two agents sharing
 * one prompt file produce two copies of the same persona.
 *
 * Provider is matched on `provider = 'openai'` (the seeded default), mirroring
 * migrations 010 and 021, so a deliberate choice Jack already made in Settings is
 * never clobbered. The prompt_path update is unconditional, mirroring migration
 * 019 — a placeholder path is a seeding bug, not a preference, and re-running
 * sets the same value.
 */
import type { ReacherDatabase } from "../database.js";

export const migration025ScoutByteAgentDefaults = {
  id: 25,
  name: "scout-byte-agent-defaults",
  up(db: ReacherDatabase): void {
    db.exec(`
      UPDATE agents
      SET provider = 'ollama', model = 'llama3.3'
      WHERE id IN ('scout-agent', 'byte-agent')
        AND provider = 'openai';

      UPDATE agents
      SET prompt_path = 'planning/agent-prompts/scout-agent.md'
      WHERE id = 'scout-agent';

      UPDATE agents
      SET prompt_path = 'planning/agent-prompts/byte-agent.md'
      WHERE id = 'byte-agent';
    `);
  }
} as const;
