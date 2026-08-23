/**
 * Search repository tests prove persisted nodes remain saveable because later
 * cases depend on search output as evidence. If repository replay dropped the
 * tree contract, a result could look complete but become impossible to save.
 */
import Database from "better-sqlite3";
import { runMigrations } from "../../src/db/migrations/runner";
import { SearchRepository } from "../../src/db/repositories/search-repository";
import { buildSearchRunResult } from "../../src/main/search/correlation";

it("persists a search run with saveable nodes so results can later attach to cases", () => {
  const db = new Database(":memory:");
  runMigrations(db);
  const repository = new SearchRepository(db);
  const run = buildSearchRunResult({
    runId: "run-one",
    seed: { type: "domain", value: "example.com" },
    startedTs: "2026-08-10T00:00:00.000Z",
    completedTs: "2026-08-10T00:00:01.000Z",
    statuses: [{ sourceId: "rdap", label: "RDAP", status: "returned", observationCount: 1 }],
    observations: [
      {
        id: "obs-one",
        runId: "run-one",
        entity: "example.com",
        type: "domain",
        value: "example.com",
        source: "rdap",
        confidence: 1
      }
    ]
  });

  repository.saveRun(run);

  expect(repository.getRun("run-one")?.tree.children[0]?.children[0]).toMatchObject({
    id: "observation:obs-one",
    saveable: true,
    pivotSeed: { type: "domain", value: "example.com" }
  });
});

it("writes observation batches before finalizing the search run so persistence is incremental", () => {
  const db = new Database(":memory:");
  runMigrations(db);
  const repository = new SearchRepository(db);
  repository.startRun("run-two", { type: "domain", value: "example.com" }, "2026-08-10T00:00:00.000Z");
  repository.appendObservations([
    {
      id: "obs-two",
      runId: "run-two",
      entity: "example.com",
      type: "domain",
      value: "example.com",
      source: "rdap",
      confidence: 1
    }
  ]);

  expect(db.prepare("SELECT COUNT(*) AS count FROM observations WHERE run_id = ?").get("run-two")).toEqual({ count: 1 });
  expect(db.prepare("SELECT completed_ts FROM search_runs WHERE id = ?").get("run-two")).toEqual({ completed_ts: null });
});
