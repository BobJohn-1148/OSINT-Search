/**
 * Agent runtime tables land together because runs, steps, and shared memory are
 * one provenance chain. If memory or steps were added later, Phase 5 could claim
 * work happened without durable evidence of how the finding was produced.
 */
import type { ReacherDatabase } from "../database.js";

export const migration009AgentsRuntime = {
  id: 9,
  name: "agents-runtime",
  up(db: ReacherDatabase): void {
    db.exec(`
      INSERT INTO agents (id, name, provider, model, prompt_path, approval_mode)
      VALUES
        ('scout-agent', 'Scout agent', 'openai', 'gpt-5.1', 'planning/agent-prompts/osint-agent.md', 'manual'),
        ('byte-agent', 'Byte agent', 'openai', 'gpt-5.1', 'planning/agent-prompts/osint-agent.md', 'manual'),
        ('ripper-agent', 'Ripper agent', 'openai', 'gpt-5.1', 'planning/agent-prompts/osint-agent.md', 'manual')
      ON CONFLICT(id) DO NOTHING;

      CREATE TABLE IF NOT EXISTS agent_runs (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        case_id TEXT,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        seed_json TEXT NOT NULL CHECK (json_valid(seed_json)),
        status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
        started_ts TEXT NOT NULL,
        completed_ts TEXT,
        error TEXT,
        FOREIGN KEY (agent_id) REFERENCES agents(id),
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS agent_steps (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'complete', 'error')),
        summary TEXT,
        next TEXT,
        sources_json TEXT NOT NULL CHECK (json_valid(sources_json)),
        ts TEXT NOT NULL,
        FOREIGN KEY (run_id) REFERENCES agent_runs(id) ON DELETE CASCADE
      ) STRICT;

      CREATE TABLE IF NOT EXISTS agent_memory (
        id TEXT PRIMARY KEY,
        scope TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        source_agent TEXT NOT NULL,
        cited_run TEXT NOT NULL,
        confidence INTEGER NOT NULL CHECK (confidence >= 1),
        ts TEXT NOT NULL,
        FOREIGN KEY (source_agent) REFERENCES agents(id),
        FOREIGN KEY (cited_run) REFERENCES agent_runs(id) ON DELETE CASCADE
      ) STRICT;

      CREATE TABLE IF NOT EXISTS agent_playbooks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        cadence TEXT NOT NULL CHECK (cadence IN ('hourly', 'daily', 'nightly', 'weekly', 'continuous')),
        active INTEGER NOT NULL CHECK (active IN (0, 1)),
        next_run_ts TEXT NOT NULL,
        FOREIGN KEY (agent_id) REFERENCES agents(id)
      ) STRICT;

      INSERT INTO agent_playbooks (id, title, agent_id, cadence, active, next_run_ts)
      VALUES
        ('daily-briefing', 'Daily morning briefing', 'osint-agent', 'daily', 1, '2026-08-11T13:00:00.000Z'),
        ('nightly-recon', 'Nightly recon digest', 'scout-agent', 'nightly', 1, '2026-08-12T02:00:00.000Z'),
        ('hourly-health', 'Hourly health check', 'byte-agent', 'hourly', 1, '2026-08-11T20:00:00.000Z'),
        ('weekly-progress', 'Weekly progress report', 'architect-agent', 'weekly', 1, '2026-08-17T14:00:00.000Z'),
        ('continuous-monitor', 'Continuous monitor', 'ripper-agent', 'continuous', 1, '2026-08-11T19:30:00.000Z')
      ON CONFLICT(id) DO NOTHING;
    `);
  }
} as const;
