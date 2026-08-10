/**
 * The first migration owns the durable contract for settings and audit events
 * because later phases rely on both tables already being strict and append-only.
 * If append-only behavior lived only in repository code, a future SQL path could
 * rewrite history without tripping SQLite itself.
 */
import type { ReacherDatabase } from "../database.js";

export const migration001Core = {
  id: 1,
  name: "core",
  up(db: ReacherDatabase): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS audit_events (
        id INTEGER PRIMARY KEY,
        ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        object_type TEXT NOT NULL,
        object_id TEXT,
        sensitivity TEXT NOT NULL CHECK (sensitivity IN ('low', 'medium', 'high')),
        detail TEXT NOT NULL CHECK (json_valid(detail))
      ) STRICT;

      CREATE TRIGGER IF NOT EXISTS audit_events_no_update
      BEFORE UPDATE ON audit_events
      BEGIN
        SELECT RAISE(ABORT, 'audit_events is append-only');
      END;

      CREATE TRIGGER IF NOT EXISTS audit_events_no_delete
      BEFORE DELETE ON audit_events
      BEGIN
        SELECT RAISE(ABORT, 'audit_events is append-only');
      END;
    `);
  }
} as const;
