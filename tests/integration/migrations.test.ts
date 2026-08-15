/**
 * Migration tests use SQLite directly because Phase 0's durability promise lives
 * in table definitions and triggers, not in mocked repositories. If these tests
 * used fake storage, strict tables and append-only enforcement could disappear
 * unnoticed.
 */
import Database from "better-sqlite3";
import { migrations } from "../../src/db/migrations";
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
    { id: 12, name: "scan-topology" },
    { id: 13, name: "analyzers" },
    { id: 14, name: "credential-monitoring" },
    { id: 15, name: "image-username-depth" },
    { id: 16, name: "tools-mobile-social" }
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
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'evtx_imports'").get()).toBeTruthy();
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'pcap_imports'").get()).toBeTruthy();
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'vuln_cache'").get()).toBeTruthy();
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'watchlist'").get()).toBeTruthy();
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'exposures'").get()).toBeTruthy();
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'monitoring_alerts'").get()).toBeTruthy();
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'image_searches'").get()).toBeTruthy();
  expect((db.prepare("SELECT COUNT(*) AS count FROM tool_catalog").get() as { count: number }).count).toBeGreaterThan(70);
  expect(db.prepare("SELECT install_command FROM tool_catalog WHERE id = 'reconftw'").get()).toEqual({
    install_command: "git clone https://github.com/six2dez/reconftw && cd reconftw && ./install.sh"
  });
  expect(db.prepare("SELECT tier, category FROM tool_catalog WHERE id = 'nuclei'").get()).toEqual({
    tier: "active",
    category: "web"
  });
  expect(db.prepare("SELECT tier, category FROM tool_catalog WHERE id = 'juice-shop-lab'").get()).toEqual({
    tier: "passive",
    category: "lab"
  });
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'mobile_device_snapshots'").get()).toBeTruthy();
});

it("phase 13 migration preserves existing tool runs so upgraded databases keep catalog evidence", () => {
  const db = openMemoryDatabase();
  for (const migration of migrations.filter((entry) => entry.id < 16)) {
    migration.up(db);
  }
  db.prepare(
    `INSERT INTO tool_runs (id, tool_id, case_id, target, wsl_distro, argv_json, status, stdout, stderr)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run("run-one", "sherlock", null, "alice", "Ubuntu", JSON.stringify(["sherlock", "alice"]), "succeeded", "ok", "");

  migrations.find((entry) => entry.id === 16)?.up(db);

  expect(db.prepare("SELECT tool_id, target, status, stdout FROM tool_runs WHERE id = 'run-one'").get()).toEqual({
    tool_id: "sherlock",
    target: "alice",
    status: "succeeded",
    stdout: "ok"
  });
  expect(db.prepare("SELECT id FROM tool_catalog WHERE id = 'nuclei'").get()).toEqual({ id: "nuclei" });
  expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
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
