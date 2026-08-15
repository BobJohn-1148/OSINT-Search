/**
 * Search persistence stores final correlated runs while the orchestrator owns
 * live execution. If connectors wrote SQL directly, a partial source failure
 * could leave a run with observations that do not match its computed tree.
 */
import type { ReacherDatabase } from "../database.js";
import type { Observation, SearchRunResult, SearchSeed, SourceCategory, SourceStatus, SourceTier } from "../../shared/types/search.js";
import { buildSearchRunResult } from "../../main/search/correlation.js";

interface SearchRunRow {
  readonly id: string;
  readonly seed_type: SearchRunResult["seed"]["type"];
  readonly seed_value: string;
  readonly started_ts: string;
  readonly completed_ts: string | null;
  readonly statuses: string;
  readonly tree: string;
}

export interface SourceRegistryInput {
  readonly id: string;
  readonly label: string;
  readonly category: SourceCategory;
  readonly tier: SourceTier;
  readonly keyRequired: boolean;
}

export class SearchRepository {
  public constructor(private readonly db: ReacherDatabase) {}

  public upsertSources(sources: readonly SourceRegistryInput[]): void {
    const insert = this.db.prepare(
      `INSERT INTO sources (id, label, category, tier, key_required)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         label = excluded.label,
         category = excluded.category,
         tier = excluded.tier,
         key_required = excluded.key_required`
    );

    const write = this.db.transaction(() => {
      for (const source of sources) {
        insert.run(source.id, source.label, source.category, source.tier, source.keyRequired ? 1 : 0);
      }
    });
    write();
  }

  public saveRun(run: SearchRunResult): void {
    const write = this.db.transaction(() => {
      this.startRun(run.runId, run.seed, run.startedTs);
      this.appendObservations(run.observations);
      this.finalizeRun(run);
    });

    write();
  }

  public startRun(runId: string, seed: SearchSeed, startedTs: string): void {
    this.db
      .prepare(
        `INSERT INTO search_runs (id, seed_type, seed_value, started_ts, completed_ts, statuses, tree)
         VALUES (?, ?, ?, ?, NULL, ?, ?)
         ON CONFLICT(id) DO NOTHING`
      )
      .run(
        runId,
        seed.type,
        seed.value,
        startedTs,
        JSON.stringify([] satisfies SourceStatus[]),
        JSON.stringify({
          id: `run:${runId}`,
          label: `${seed.type}:${seed.value}`,
          kind: "root",
          saveable: true,
          pivotSeed: seed,
          children: []
        })
      );
  }

  public appendObservations(observations: readonly Observation[]): void {
    const insertObservation = this.db.prepare(
      `INSERT OR IGNORE INTO observations (id, run_id, entity, type, value, source, confidence, raw)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const write = this.db.transaction(() => {
      for (const observation of observations) {
        insertObservation.run(
          observation.id,
          observation.runId,
          observation.entity,
          observation.type,
          observation.value,
          observation.source,
          observation.confidence,
          JSON.stringify(observation.raw ?? {})
        );
      }
    });
    write();
  }

  public finalizeRun(run: SearchRunResult): void {
    const write = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE search_runs
           SET completed_ts = ?, statuses = ?, tree = ?
           WHERE id = ?`
        )
        .run(run.completedTs, JSON.stringify(run.statuses), JSON.stringify(run.tree), run.runId);

      const insertLink = this.db.prepare(
        `INSERT OR IGNORE INTO entity_links (entity_a, entity_b, run_id)
         VALUES (?, ?, ?)`
      );
      for (const entity of run.entities) {
        for (const sourceId of entity.sourceIds) {
          insertLink.run(entity.entity, sourceId, run.runId);
        }
      }
    });
    write();
  }

  public getRun(runId: string): SearchRunResult | null {
    const row = this.db.prepare("SELECT * FROM search_runs WHERE id = ?").get(runId) as SearchRunRow | undefined;
    if (!row) {
      return null;
    }

    const observations = this.db
      .prepare("SELECT id, run_id, entity, type, value, source, confidence, raw FROM observations WHERE run_id = ? ORDER BY id")
      .all(runId)
      .map((observation) => {
        const rowValue = observation as {
          id: string;
          run_id: string;
          entity: string;
          type: string;
          value: string;
          source: string;
          confidence: number;
          raw: string;
        };
        return {
          id: rowValue.id,
          runId: rowValue.run_id,
          entity: rowValue.entity,
          type: rowValue.type,
          value: rowValue.value,
          source: rowValue.source,
          confidence: rowValue.confidence,
          raw: JSON.parse(rowValue.raw) as Record<string, unknown>
        };
      });

    return buildSearchRunResult({
      runId: row.id,
      seed: { type: row.seed_type, value: row.seed_value },
      startedTs: row.started_ts,
      completedTs: row.completed_ts,
      statuses: JSON.parse(row.statuses) as SearchRunResult["statuses"],
      observations
    });
  }
}
