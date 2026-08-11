/**
 * Analyzer imports and CVE cache need durable rows because parsed evidence must
 * remain reportable after the source file or API response is gone. If analyzer
 * state stayed in memory, save-to-case would not be reproducible later.
 */
import type { ReacherDatabase } from "../database.js";

export const migration013Analyzers = {
  id: 13,
  name: "analyzers",
  up(db: ReacherDatabase): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS evtx_imports (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        event_count INTEGER NOT NULL CHECK (event_count >= 0),
        created_ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;

      CREATE TABLE IF NOT EXISTS pcap_imports (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        conversation_count INTEGER NOT NULL CHECK (conversation_count >= 0),
        created_ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;

      CREATE TABLE IF NOT EXISTS vuln_cache (
        cache_key TEXT PRIMARY KEY,
        product TEXT NOT NULL,
        version TEXT,
        response_json TEXT NOT NULL CHECK (json_valid(response_json)),
        fetched_ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;
    `);
  }
} as const;
