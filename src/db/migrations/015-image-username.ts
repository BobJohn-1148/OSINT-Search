/**
 * Image search rows persist the provider path separately from observations so
 * uploaded files can be traced after the correlation tree is rebuilt. If only
 * derived observations were stored, reverse-image provenance would be lossy.
 */
import type { ReacherDatabase } from "../database.js";

export const migration015ImageUsername = {
  id: 15,
  name: "image-username-depth",
  up(db: ReacherDatabase): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS image_searches (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL,
        source TEXT NOT NULL,
        result_ref TEXT NOT NULL,
        ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;
    `);
  }
} as const;
