/**
 * Audit query tests pin filter semantics on the real append-only table. If date
 * and target filtering were tested through mocked arrays, sensitive review could
 * hide records once SQLite ordering or JSON detail text changed.
 */
import Database from "better-sqlite3";
import { AuditRepository } from "../../src/db/repositories/audit-repository";
import { runMigrations } from "../../src/db/migrations/runner";

function openAuditRepository() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  const auditRepository = new AuditRepository(db);
  return { db, auditRepository };
}

it("filters audit by type and date so sensitive history is reviewable", () => {
  const { db, auditRepository } = openAuditRepository();
  db.prepare(
    `INSERT INTO audit_events (ts, actor, action, object_type, object_id, sensitivity, detail)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "2026-08-10T10:00:00.000Z",
    "local-user",
    "keys.read",
    "key",
    "openai",
    "sensitive",
    JSON.stringify({ target: "openai" })
  );
  db.prepare(
    `INSERT INTO audit_events (ts, actor, action, object_type, object_id, sensitivity, detail)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "2026-08-11T10:00:00.000Z",
    "local-user",
    "case.create",
    "case",
    "case-one",
    "low",
    JSON.stringify({ target: "case-one" })
  );

  const events = auditRepository.query({
    action: "keys.read",
    objectType: "key",
    target: "openai",
    sensitivity: "sensitive",
    dateFrom: "2026-08-10",
    dateTo: "2026-08-10",
    limit: 20
  });

  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    action: "keys.read",
    objectType: "key",
    objectId: "openai",
    sensitivity: "sensitive"
  });
});
