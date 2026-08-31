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
    { id: 16, name: "tools-mobile-social" },
    { id: 17, name: "case-documents" },
    { id: 18, name: "malware-agent" },
    { id: 19, name: "ripper-agent-prompt" },
    { id: 20, name: "agent-reasoning-effort" },
    { id: 21, name: "free-osint-ai" },
    { id: 22, name: "3utools-catalog" },
    { id: 23, name: "ios-mobile-tool-catalog" },
    { id: 24, name: "revshells-lab-tool-catalog" },
    { id: 25, name: "scout-byte-agent-defaults" },
    { id: 26, name: "runnable-agent-models" },
    { id: 27, name: "architect-agent-runnable-default" },
    { id: 28, name: "pattern-agent" }
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
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'case_documents'").get()).toBeTruthy();
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
  // Ported from the Codex branch (migrations 022–024): the 3uTools / iOS-mobile /
  // RevShells catalog seeds must land so no cross-branch tool work is lost.
  expect(db.prepare("SELECT category, tier FROM tool_catalog WHERE id = '3utools'").get()).toEqual({ category: "mobile", tier: "passive" });
  expect(db.prepare("SELECT category, tier FROM tool_catalog WHERE id = 'revshells'").get()).toEqual({ category: "lab", tier: "passive" });
  expect((db.prepare("SELECT COUNT(*) AS count FROM tool_catalog WHERE id IN ('idevicebackup2','mvt-ios','ileapp','pymobiledevice3','ifuse')").get() as { count: number }).count).toBe(5);
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'mobile_device_snapshots'").get()).toBeTruthy();
  expect(db.prepare("SELECT name, prompt_path FROM agents WHERE id = 'malware-analyst-agent'").get()).toEqual({
    name: "Malware analyst",
    prompt_path: "planning/agent-prompts/malware-analyst.md"
  });
  // Migration 019 repoints ripper-agent off the shared OSINT prompt onto its own.
  expect(db.prepare("SELECT prompt_path FROM agents WHERE id = 'ripper-agent'").get()).toEqual({
    prompt_path: "planning/agent-prompts/ripper-agent.md"
  });
  // Migration 020 adds a nullable reasoning_effort column, unset by default.
  expect(db.prepare("SELECT reasoning_effort FROM agents WHERE id = 'osint-agent'").get()).toEqual({
    reasoning_effort: null
  });
  // Migration 021 repoints the investigation agents onto the free local runtime;
  // migration 026 then lands them on a model that fits in consumer RAM instead of
  // a 70B one that never could. Migration 027 does the same move for the
  // architect agent once it started making a real model call instead of
  // producing template text on 'openai', which was never actually reachable.
  expect(db.prepare("SELECT provider, model FROM agents WHERE id = 'osint-agent'").get()).toEqual({
    provider: "ollama",
    model: "llama3.1:8b"
  });
  expect(db.prepare("SELECT provider FROM agents WHERE id = 'malware-analyst-agent'").get()).toEqual({ provider: "ollama" });
  expect(db.prepare("SELECT provider, model FROM agents WHERE id = 'architect-agent'").get()).toEqual({
    provider: "ollama",
    model: "llama3.1:8b"
  });
  // Migration 028 seeds the fourth agent, defaulting to the same runnable local
  // model as every other agent migrations 026/027 moved onto.
  expect(db.prepare("SELECT provider, model, prompt_path FROM agents WHERE id = 'pattern-agent'").get()).toEqual({
    provider: "ollama",
    model: "llama3.1:8b",
    prompt_path: "planning/agent-prompts/pattern-agent.md"
  });
});

it("migration 026 leaves a deliberately chosen model alone so a bigger machine keeps its 70B pick", () => {
  const db = openMemoryDatabase();
  for (const migration of migrations.filter((entry) => entry.id < 26)) {
    migration.up(db);
  }
  // Stand in for Jack picking a heavier model in Settings on capable hardware.
  db.prepare("UPDATE agents SET model = 'qwen2.5:14b' WHERE id = 'scout-agent'").run();

  migrations.find((entry) => entry.id === 26)?.up(db);

  expect(db.prepare("SELECT model FROM agents WHERE id = 'scout-agent'").get()).toEqual({ model: "qwen2.5:14b" });
  expect(db.prepare("SELECT model FROM agents WHERE id = 'osint-agent'").get()).toEqual({ model: "llama3.1:8b" });
});

it("migration 026 corrects an unreachable Anthropic model id, because a real call would 404 on it", () => {
  const db = openMemoryDatabase();
  for (const migration of migrations.filter((entry) => entry.id < 26)) {
    migration.up(db);
  }
  db.prepare("UPDATE agents SET provider = 'anthropic', model = 'claude-sonnet-4.5' WHERE id = 'ripper-agent'").run();

  migrations.find((entry) => entry.id === 26)?.up(db);

  expect(db.prepare("SELECT provider, model FROM agents WHERE id = 'ripper-agent'").get()).toEqual({
    provider: "anthropic",
    model: "claude-sonnet-5"
  });
});

it("migration 027 moves the architect agent off 'openai' (never reachable) onto a runnable local default", () => {
  const db = openMemoryDatabase();
  for (const migration of migrations.filter((entry) => entry.id < 27)) {
    migration.up(db);
  }
  expect(db.prepare("SELECT provider, model FROM agents WHERE id = 'architect-agent'").get()).toEqual({
    provider: "openai",
    model: "codex"
  });

  migrations.find((entry) => entry.id === 27)?.up(db);

  expect(db.prepare("SELECT provider, model FROM agents WHERE id = 'architect-agent'").get()).toEqual({
    provider: "ollama",
    model: "llama3.1:8b"
  });
});

it("migration 027 leaves a deliberately chosen architect provider alone", () => {
  const db = openMemoryDatabase();
  for (const migration of migrations.filter((entry) => entry.id < 27)) {
    migration.up(db);
  }
  db.prepare("UPDATE agents SET provider = 'anthropic', model = 'claude-sonnet-5' WHERE id = 'architect-agent'").run();

  migrations.find((entry) => entry.id === 27)?.up(db);

  expect(db.prepare("SELECT provider, model FROM agents WHERE id = 'architect-agent'").get()).toEqual({
    provider: "anthropic",
    model: "claude-sonnet-5"
  });
});

it("migration 028 widens case_items.item_type without losing existing rows or the FTS index", () => {
  const db = openMemoryDatabase();
  for (const migration of migrations.filter((entry) => entry.id < 28)) {
    migration.up(db);
  }
  db.prepare("INSERT INTO cases (id, title, status) VALUES ('case-one', 'Pre-existing case', 'open')").run();
  db.prepare(
    `INSERT INTO case_items (id, case_id, item_type, ref_id, title, text, source_ts, metadata)
     VALUES ('item-one', 'case-one', 'observation', NULL, 'Pre-existing item', 'mentions jdoe', '2026-01-01T00:00:00.000Z', '{}')`
  ).run();
  expect(() =>
    db.prepare(
      `INSERT INTO case_items (id, case_id, item_type, ref_id, title, text, source_ts, metadata)
       VALUES ('item-blocked', 'case-one', 'pattern_finding', NULL, 't', 't', '2026-01-01T00:00:00.000Z', '{}')`
    ).run()
  ).toThrow();

  migrations.find((entry) => entry.id === 28)?.up(db);

  expect(db.prepare("SELECT id, item_type, title FROM case_items WHERE id = 'item-one'").get()).toEqual({
    id: "item-one",
    item_type: "observation",
    title: "Pre-existing item"
  });
  db.prepare(
    `INSERT INTO case_items (id, case_id, item_type, ref_id, title, text, source_ts, metadata)
     VALUES ('item-two', 'case-one', 'pattern_finding', NULL, 'Pattern item', 'pattern text', '2026-01-01T00:00:00.000Z', '{}')`
  ).run();
  expect(db.prepare("SELECT id FROM case_items_fts WHERE case_items_fts MATCH 'jdoe'").all()).toEqual([{ id: "item-one" }]);
  expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
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
