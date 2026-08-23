/**
 * Cases and case items land together because save-to-case only works when the
 * container, evidence row, tags, and FTS index are one schema contract. If FTS
 * were bolted on later, saved evidence could exist but be undiscoverable.
 */
import type { ReacherDatabase } from "../database.js";

export const migration007Cases = {
  id: 7,
  name: "cases",
  up(db: ReacherDatabase): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS cases (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('open', 'archived')),
        created_ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;

      CREATE TABLE IF NOT EXISTS case_tags (
        case_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY (case_id, tag),
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
      ) STRICT;

      CREATE TABLE IF NOT EXISTS case_items (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL,
        item_type TEXT NOT NULL CHECK (item_type IN ('observation', 'scan', 'tool_run', 'agent_run', 'note', 'report')),
        ref_id TEXT,
        title TEXT NOT NULL,
        text TEXT NOT NULL,
        source_ts TEXT NOT NULL,
        metadata TEXT NOT NULL CHECK (json_valid(metadata)),
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
      ) STRICT;

      CREATE VIRTUAL TABLE IF NOT EXISTS case_items_fts
      USING fts5(id UNINDEXED, case_id UNINDEXED, title, text, content='case_items', content_rowid='rowid');

      CREATE TRIGGER IF NOT EXISTS case_items_ai AFTER INSERT ON case_items BEGIN
        INSERT INTO case_items_fts(rowid, id, case_id, title, text)
        VALUES (new.rowid, new.id, new.case_id, new.title, new.text);
      END;

      CREATE TRIGGER IF NOT EXISTS case_items_ad AFTER DELETE ON case_items BEGIN
        INSERT INTO case_items_fts(case_items_fts, rowid, id, case_id, title, text)
        VALUES ('delete', old.rowid, old.id, old.case_id, old.title, old.text);
      END;

      CREATE TRIGGER IF NOT EXISTS case_items_au AFTER UPDATE ON case_items BEGIN
        INSERT INTO case_items_fts(case_items_fts, rowid, id, case_id, title, text)
        VALUES ('delete', old.rowid, old.id, old.case_id, old.title, old.text);
        INSERT INTO case_items_fts(rowid, id, case_id, title, text)
        VALUES (new.rowid, new.id, new.case_id, new.title, new.text);
      END;
    `);
  }
} as const;
