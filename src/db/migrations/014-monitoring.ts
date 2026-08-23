/**
 * Monitoring tables persist watches, deduped exposures, and alerts because a
 * scheduled check must survive app restarts. If alerts lived only in memory,
 * Jack could miss breach changes whenever the desktop app was closed.
 */
import type { ReacherDatabase } from "../database.js";

export const migration014Monitoring = {
  id: 14,
  name: "credential-monitoring",
  up(db: ReacherDatabase): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS watchlist (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('email', 'domain')),
        value TEXT NOT NULL,
        case_id TEXT,
        check_interval_minutes INTEGER NOT NULL CHECK (check_interval_minutes >= 1),
        created_ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        last_checked_ts TEXT,
        removed_ts TEXT,
        UNIQUE (type, value),
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS exposures (
        id TEXT PRIMARY KEY,
        watch_id TEXT NOT NULL,
        source TEXT NOT NULL,
        title TEXT NOT NULL,
        detail TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        first_seen_ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        last_seen_ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE (watch_id, source, fingerprint),
        FOREIGN KEY (watch_id) REFERENCES watchlist(id) ON DELETE RESTRICT
      ) STRICT;

      CREATE TABLE IF NOT EXISTS monitoring_alerts (
        id TEXT PRIMARY KEY,
        exposure_id TEXT NOT NULL,
        watch_id TEXT NOT NULL,
        message TEXT NOT NULL,
        created_ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        acknowledged_ts TEXT,
        FOREIGN KEY (exposure_id) REFERENCES exposures(id) ON DELETE RESTRICT,
        FOREIGN KEY (watch_id) REFERENCES watchlist(id) ON DELETE RESTRICT
      ) STRICT;

      CREATE TRIGGER IF NOT EXISTS exposures_no_delete
      BEFORE DELETE ON exposures
      BEGIN
        SELECT RAISE(ABORT, 'exposures is append-only');
      END;

      CREATE TRIGGER IF NOT EXISTS exposures_no_update
      BEFORE UPDATE OF id, watch_id, source, title, detail, fingerprint, first_seen_ts ON exposures
      BEGIN
        SELECT RAISE(ABORT, 'exposures core fields are append-only');
      END;

      CREATE TRIGGER IF NOT EXISTS monitoring_alerts_no_delete
      BEFORE DELETE ON monitoring_alerts
      BEGIN
        SELECT RAISE(ABORT, 'monitoring_alerts is append-only');
      END;

      CREATE TRIGGER IF NOT EXISTS monitoring_alerts_no_update
      BEFORE UPDATE OF id, exposure_id, watch_id, message, created_ts ON monitoring_alerts
      BEGIN
        SELECT RAISE(ABORT, 'monitoring_alerts core fields are append-only');
      END;
    `);
  }
} as const;
