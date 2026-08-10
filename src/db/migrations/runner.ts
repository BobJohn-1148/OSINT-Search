/**
 * The runner applies migrations inside transactions so schema state and the
 * migration ledger cannot disagree. If migration ids were marked separately from
 * their SQL, a crash could make startup skip a half-applied migration.
 */
import type { ReacherDatabase } from "../database.js";
import { migrations } from "./index.js";

interface AppliedMigrationRow {
  readonly id: number;
}

export function runMigrations(db: ReacherDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ) STRICT;
  `);

  const appliedRows = db.prepare("SELECT id FROM schema_migrations").all() as AppliedMigrationRow[];
  const applied = new Set(appliedRows.map((row) => row.id));

  for (const migration of migrations) {
    if (applied.has(migration.id)) {
      continue;
    }

    const applyMigration = db.transaction(() => {
      migration.up(db);
      db.prepare("INSERT INTO schema_migrations (id, name) VALUES (?, ?)").run(migration.id, migration.name);
    });

    applyMigration();
  }
}
