/**
 * Case documents are separate from evidence items because notes, scope, and
 * date ranges need editable working papers, while evidence stays append-style.
 */
import type { ReacherDatabase } from "../database.js";

export const migration017CaseDocuments = {
  id: 17,
  name: "case-documents",
  up(db: ReacherDatabase): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS case_documents (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL,
        name TEXT NOT NULL,
        scope TEXT NOT NULL,
        date_from TEXT NOT NULL,
        date_to TEXT NOT NULL,
        body TEXT NOT NULL,
        created_ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
      ) STRICT;

      CREATE INDEX IF NOT EXISTS idx_case_documents_case_id ON case_documents(case_id);
    `);
  }
} as const;
