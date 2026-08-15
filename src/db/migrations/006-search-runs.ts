/**
 * Search runs are stored before observations can be replayed or pivoted because
 * the investigator needs one durable profile per seed. If observations floated
 * without a run row, pivots and later case saves would lose provenance.
 */
import type { ReacherDatabase } from "../database.js";

export const migration006SearchRuns = {
  id: 6,
  name: "search-runs",
  up(db: ReacherDatabase): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS search_runs (
        id TEXT PRIMARY KEY,
        seed_type TEXT NOT NULL,
        seed_value TEXT NOT NULL,
        started_ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        completed_ts TEXT,
        statuses TEXT NOT NULL CHECK (json_valid(statuses)),
        tree TEXT NOT NULL CHECK (json_valid(tree))
      ) STRICT;
    `);
  }
} as const;
