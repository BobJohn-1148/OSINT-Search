/**
 * Settings writes stay behind one repository because Phase 0 stores only simple
 * local preferences and later phases will add more sensitive stores. If settings
 * became a casual SQL shortcut, it would be tempting to hide keys or auth records
 * here instead of routing them through their audited gates.
 */
import type { ReacherDatabase } from "../database.js";

interface SettingsRow {
  readonly key: string;
  readonly value: string;
}

export class SettingsRepository {
  public constructor(private readonly db: ReacherDatabase) {}

  public get(key: string): string | null {
    const row = this.db.prepare("SELECT key, value FROM settings WHERE key = ?").get(key) as SettingsRow | undefined;
    return row?.value ?? null;
  }

  public set(key: string, value: string): void {
    this.db
      .prepare(
        `INSERT INTO settings (key, value)
         VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .run(key, value);
  }
}
