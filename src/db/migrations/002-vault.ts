/**
 * Vault storage is introduced in its own migration because encrypted key rows
 * and sensitive audit events become a shared security contract after Phase 1.
 * If the audit sensitivity check stayed Phase 0-only, key reads could not be
 * marked with the stronger sensitivity the invariant requires.
 */
import type { ReacherDatabase } from "../database.js";

export const migration002Vault = {
  id: 2,
  name: "vault",
  up(db: ReacherDatabase): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY,
        source TEXT NOT NULL UNIQUE,
        ciphertext TEXT NOT NULL,
        created_ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        last_used_ts TEXT
      ) STRICT;

      DROP TRIGGER IF EXISTS audit_events_no_update;
      DROP TRIGGER IF EXISTS audit_events_no_delete;

      CREATE TABLE audit_events_rebuild (
        id INTEGER PRIMARY KEY,
        ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        object_type TEXT NOT NULL,
        object_id TEXT,
        sensitivity TEXT NOT NULL CHECK (sensitivity IN ('low', 'medium', 'high', 'sensitive')),
        detail TEXT NOT NULL CHECK (json_valid(detail))
      ) STRICT;

      INSERT INTO audit_events_rebuild (id, ts, actor, action, object_type, object_id, sensitivity, detail)
      SELECT id, ts, actor, action, object_type, object_id, sensitivity, detail
      FROM audit_events;

      DROP TABLE audit_events;
      ALTER TABLE audit_events_rebuild RENAME TO audit_events;

      CREATE TRIGGER audit_events_no_update
      BEFORE UPDATE ON audit_events
      BEGIN
        SELECT RAISE(ABORT, 'audit_events is append-only');
      END;

      CREATE TRIGGER audit_events_no_delete
      BEFORE DELETE ON audit_events
      BEGIN
        SELECT RAISE(ABORT, 'audit_events is append-only');
      END;
    `);
  }
} as const;
