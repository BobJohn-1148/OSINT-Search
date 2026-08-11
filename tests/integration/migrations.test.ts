/**
 * Migration tests use SQLite directly because Phase 0's durability promise lives
 * in table definitions and triggers, not in mocked repositories. If these tests
 * used fake storage, strict tables and append-only enforcement could disappear
 * unnoticed.
 */
import Database from "better-sqlite3";
import { runMigrations } from "../../src/db/migrations/runner";

function openMemoryDatabase() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  return db;
}

it("migration runner applies migrations and is idempotent on second run", () => {
  const db = openMemoryDatabase();

  runMigrations(db);
  runMigrations(db);

  const rows = db.prepare("SELECT id, name FROM schema_migrations ORDER BY id").all();
  expect(rows).toEqual([
    { id: 1, name: "core" },
    { id: 2, name: "vault" },
    { id: 3, name: "agents" },
    { id: 4, name: "sources" },
    { id: 5, name: "observations" },
    { id: 6, name: "search-runs" },
    { id: 7, name: "cases" },
    { id: 8, name: "reports" },
    { id: 9, name: "agents-runtime" },
    { id: 10, name: "architect-agent" },
    { id: 11, name: "tools-wsl" },
    { id: 12, name: "scan-topology" }
  ]);
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'settings'").get()).toBeTruthy();
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'audit_events'").get()).toBeTruthy();
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'api_keys'").get()).toBeTruthy();
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'agents'").get()).toBeTruthy();
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sources'").get()).toBeTruthy();
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'observations'").get()).toBeTruthy();
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'search_runs'").get()).toBeTruthy();
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'cases'").get()).toBeTruthy();
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'case_items'").get()).toBeTruthy();
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'reports'").get()).toBeTruthy();
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'agent_runs'").get()).toBeTruthy();
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'agent_memory'").get()).toBeTruthy();
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'tool_catalog'").get()).toBeTruthy();
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'tool_runs'").get()).toBeTruthy();
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'authorizations'").get()).toBeTruthy();
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'scans'").get()).toBeTruthy();
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'hosts'").get()).toBeTruthy();
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'ports'").get()).toBeTruthy();
  expect(db.prepare("SELECT COUNT(*) AS count FROM tool_catalog").get()).toEqual({ count: 11 });
  expect(db.prepare("SELECT install_command FROM tool_catalog WHERE id = 'reconftw'").get()).toEqual({
    install_command: "git clone https://github.com/six2dez/reconftw && cd reconftw && ./install.sh"
  });
});

it("an audit_events row cannot be updated or deleted because history is append-only", () => {
  const db = openMemoryDatabase();
  runMigrations(db);
  db.prepare(
    `INSERT INTO audit_events (actor, action, object_type, object_id, sensitivity, detail)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run("local-user", "test.action", "test", "one", "low", "{}");

  expect(() => db.prepare("UPDATE audit_events SET action = ? WHERE id = 1").run("changed")).toThrow(
    /audit_events is append-only/
  );
  expect(() => db.prepare("DELETE FROM audit_events WHERE id = 1").run()).toThrow(/audit_events is append-only/);
});
