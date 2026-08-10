/**
 * Migrations are numbered data contracts, not startup suggestions. The runner
 * records every applied id in SQLite so a second boot is idempotent and a later
 * phase cannot accidentally replay schema changes against Jack's local store.
 */
import type { ReacherDatabase } from "../database.js";
import { migration001Core } from "./001-core.js";

export interface Migration {
  readonly id: number;
  readonly name: string;
  up(db: ReacherDatabase): void;
}

export const migrations: readonly Migration[] = [migration001Core];
