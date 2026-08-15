/**
 * Case repository tests pin the save-to-case invariant at the SQL boundary
 * because every future surface will rely on this repository. If evidence saves
 * skipped timeline, summary, or FTS behavior, reports would miss Jack's work.
 */
import Database from "better-sqlite3";
import { runMigrations } from "../../src/db/migrations/runner";
import { CasesRepository } from "../../src/db/repositories/cases-repository";

function createRepository() {
  const db = new Database(":memory:");
  runMigrations(db);
  return new CasesRepository(db);
}

it("saves a search observation to a case so investigation output becomes evidence", () => {
  const repository = createRepository();
  const caseRecord = repository.create("Acme review", ["client"]);
  const item = repository.addItem({
    caseId: caseRecord.id,
    itemType: "observation",
    refId: "obs-one",
    title: "example.com",
    text: "example.com appeared in RDAP",
    sourceTs: "2026-08-10T10:00:00.000Z",
    metadata: { entity: "example.com", strength: 3 }
  });

  expect(repository.timeline(caseRecord.id)).toEqual([item]);
});

it("timeline is ordered by time so evidence reads chronologically", () => {
  const repository = createRepository();
  const caseRecord = repository.create("Timeline", []);
  repository.addItem({
    caseId: caseRecord.id,
    itemType: "note",
    title: "Later",
    text: "Later note",
    sourceTs: "2026-08-10T12:00:00.000Z",
    metadata: {}
  });
  repository.addItem({
    caseId: caseRecord.id,
    itemType: "note",
    title: "Earlier",
    text: "Earlier note",
    sourceTs: "2026-08-10T09:00:00.000Z",
    metadata: {}
  });

  expect(repository.timeline(caseRecord.id).map((item) => item.title)).toEqual(["Earlier", "Later"]);
});

it("summary aggregates key entities by strength so strong evidence rises first", () => {
  const repository = createRepository();
  const caseRecord = repository.create("Summary", []);
  repository.addItem({
    caseId: caseRecord.id,
    itemType: "observation",
    title: "example.com",
    text: "Strong entity",
    metadata: { entity: "example.com", strength: 3 }
  });
  repository.addItem({
    caseId: caseRecord.id,
    itemType: "observation",
    title: "other.example",
    text: "Weak entity",
    metadata: { entity: "other.example", strength: 1 }
  });

  const summary = repository.summary(caseRecord.id);
  expect(summary.counts).toEqual({ observation: 2 });
  expect(summary.keyEntities[0]).toEqual({ entity: "example.com", strength: 3, count: 1 });
});

it("FTS finds a saved value by substring so case evidence is searchable", () => {
  const repository = createRepository();
  const caseRecord = repository.create("Search", []);
  repository.addItem({
    caseId: caseRecord.id,
    itemType: "observation",
    title: "Domain hit",
    text: "needlecorp.example was observed in certificate transparency",
    metadata: {}
  });

  expect(repository.search(caseRecord.id, "needlecorp").map((item) => item.title)).toEqual(["Domain hit"]);
});

it("search accepts domain ip and email queries so OSINT values do not break FTS", () => {
  const repository = createRepository();
  const caseRecord = repository.create("Search syntax", []);
  repository.addItem({
    caseId: caseRecord.id,
    itemType: "observation",
    title: "Mixed indicators",
    text: "example.com resolved to 192.168.1.1 and alice@example.com owned the record",
    metadata: {}
  });

  expect(repository.search(caseRecord.id, "example.com").map((item) => item.title)).toEqual(["Mixed indicators"]);
  expect(repository.search(caseRecord.id, "192.168.1.1").map((item) => item.title)).toEqual(["Mixed indicators"]);
  expect(repository.search(caseRecord.id, "alice@example.com").map((item) => item.title)).toEqual(["Mixed indicators"]);
});
