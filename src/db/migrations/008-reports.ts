/**
 * Reports are durable artifacts with local paths because exports must be
 * auditable after generation. If only files existed on disk, Jack could not tell
 * which case produced which document or when it was generated.
 */
import type { ReacherDatabase } from "../database.js";

export const migration008Reports = {
  id: 8,
  name: "reports",
  up(db: ReacherDatabase): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        case_id TEXT,
        scan_id TEXT,
        format TEXT NOT NULL CHECK (format IN ('pdf', 'docx')),
        path TEXT NOT NULL,
        created_ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        CHECK ((case_id IS NOT NULL AND scan_id IS NULL) OR (case_id IS NULL AND scan_id IS NOT NULL)),
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
      ) STRICT;
    `);
  }
} as const;
