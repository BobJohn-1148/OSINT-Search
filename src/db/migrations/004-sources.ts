/**
 * Sources are a registry table because connector availability and key needs must
 * be inspectable without importing runtime connector code. If sources only lived
 * in TypeScript, later Settings and reports could not cite the configured spine.
 */
import type { ReacherDatabase } from "../database.js";

export const migration004Sources = {
  id: 4,
  name: "sources",
  up(db: ReacherDatabase): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        category TEXT NOT NULL,
        tier TEXT NOT NULL CHECK (tier IN ('passive', 'active')),
        key_required INTEGER NOT NULL CHECK (key_required IN (0, 1))
      ) STRICT;
    `);
  }
} as const;
