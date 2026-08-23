/**
 * Observations and entity links store cited facts separately from derived search
 * summaries. If confidence were stored as an arbitrary note instead of computed
 * links, the app could not defend why a claim is strong or merely single-source.
 */
import type { ReacherDatabase } from "../database.js";

export const migration005Observations = {
  id: 5,
  name: "observations",
  up(db: ReacherDatabase): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS observations (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        entity TEXT NOT NULL,
        type TEXT NOT NULL,
        value TEXT NOT NULL,
        source TEXT NOT NULL,
        confidence INTEGER NOT NULL CHECK (confidence >= 1),
        raw TEXT NOT NULL CHECK (json_valid(raw)),
        created_ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        FOREIGN KEY (run_id) REFERENCES search_runs(id) ON DELETE CASCADE
      ) STRICT;

      CREATE TABLE IF NOT EXISTS entity_links (
        entity_a TEXT NOT NULL,
        entity_b TEXT NOT NULL,
        run_id TEXT NOT NULL,
        PRIMARY KEY (entity_a, entity_b, run_id),
        FOREIGN KEY (run_id) REFERENCES search_runs(id) ON DELETE CASCADE
      ) STRICT;
    `);
  }
} as const;
