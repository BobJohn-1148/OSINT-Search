/**
 * Migrations are numbered data contracts, not startup suggestions. The runner
 * records every applied id in SQLite so a second boot is idempotent and a later
 * phase cannot accidentally replay schema changes against Jack's local store.
 */
import type { ReacherDatabase } from "../database.js";
import { migration001Core } from "./001-core.js";
import { migration002Vault } from "./002-vault.js";
import { migration003Agents } from "./003-agents.js";
import { migration004Sources } from "./004-sources.js";
import { migration005Observations } from "./005-observations.js";
import { migration006SearchRuns } from "./006-search-runs.js";

export interface Migration {
  readonly id: number;
  readonly name: string;
  up(db: ReacherDatabase): void;
}

export const migrations: readonly Migration[] = [
  migration001Core,
  migration002Vault,
  migration003Agents,
  migration004Sources,
  migration005Observations,
  migration006SearchRuns
];
