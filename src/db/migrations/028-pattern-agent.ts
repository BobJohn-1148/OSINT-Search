/**
 * SQLite has no ALTER TABLE for a CHECK constraint, so widening case_items'
 * item_type list to accept 'pattern_finding' means the same rename/rebuild/copy
 * used for tool_catalog in migration 016 -- except case_items also carries an
 * FTS5 external-content table and three triggers bound to it (case_items_ai/
 * ad/au), so those have to be dropped before the rename and rebuilt afterward,
 * then the FTS index rebuilt from the repopulated table rather than copied,
 * since 'rebuild' is the documented way to resync an external-content index
 * after its content table's rowids have moved.
 *
 * pattern-agent is seeded here rather than in 003-agents.ts because it is a new
 * agent, not a Phase 1 default -- same reasoning migration 009 used for
 * scout/byte/ripper. It defaults to ollama/llama3.1:8b like every other agent
 * migration 026 and 027 moved onto a runnable local default, for the same
 * reason: zero-cost and guaranteed to fit Jack's hardware out of the box.
 */
import type { ReacherDatabase } from "../database.js";

export const migration028PatternAgent = {
  id: 28,
  name: "pattern-agent",
  up(db: ReacherDatabase): void {
    db.exec(`
      DROP TRIGGER IF EXISTS case_items_ai;
      DROP TRIGGER IF EXISTS case_items_ad;
      DROP TRIGGER IF EXISTS case_items_au;
      DROP TABLE IF EXISTS case_items_fts;

      ALTER TABLE case_items RENAME TO case_items_phase3;

      CREATE TABLE case_items (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL,
        item_type TEXT NOT NULL CHECK (item_type IN ('observation', 'scan', 'tool_run', 'agent_run', 'note', 'report', 'pattern_finding')),
        ref_id TEXT,
        title TEXT NOT NULL,
        text TEXT NOT NULL,
        source_ts TEXT NOT NULL,
        metadata TEXT NOT NULL CHECK (json_valid(metadata)),
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
      ) STRICT;

      INSERT INTO case_items (id, case_id, item_type, ref_id, title, text, source_ts, metadata)
      SELECT id, case_id, item_type, ref_id, title, text, source_ts, metadata
      FROM case_items_phase3;

      DROP TABLE case_items_phase3;

      CREATE VIRTUAL TABLE case_items_fts
      USING fts5(id UNINDEXED, case_id UNINDEXED, title, text, content='case_items', content_rowid='rowid');

      CREATE TRIGGER case_items_ai AFTER INSERT ON case_items BEGIN
        INSERT INTO case_items_fts(rowid, id, case_id, title, text)
        VALUES (new.rowid, new.id, new.case_id, new.title, new.text);
      END;

      CREATE TRIGGER case_items_ad AFTER DELETE ON case_items BEGIN
        INSERT INTO case_items_fts(case_items_fts, rowid, id, case_id, title, text)
        VALUES ('delete', old.rowid, old.id, old.case_id, old.title, old.text);
      END;

      CREATE TRIGGER case_items_au AFTER UPDATE ON case_items BEGIN
        INSERT INTO case_items_fts(case_items_fts, rowid, id, case_id, title, text)
        VALUES ('delete', old.rowid, old.id, old.case_id, old.title, old.text);
        INSERT INTO case_items_fts(rowid, id, case_id, title, text)
        VALUES (new.rowid, new.id, new.case_id, new.title, new.text);
      END;

      INSERT INTO case_items_fts(case_items_fts) VALUES ('rebuild');

      INSERT INTO agents (id, name, provider, model, prompt_path, approval_mode)
      VALUES ('pattern-agent', 'Pattern agent', 'ollama', 'llama3.1:8b', 'planning/agent-prompts/pattern-agent.md', 'manual')
      ON CONFLICT(id) DO NOTHING;
    `);
  }
} as const;
