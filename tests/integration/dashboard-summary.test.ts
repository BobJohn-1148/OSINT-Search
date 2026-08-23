/**
 * Dashboard summary tests use migrated SQLite because Phase 12 is a cross-table
 * read model. If this used mocked rows, the home surface could pass tests while
 * pointing at columns that do not exist in the packaged app.
 */
import Database from "better-sqlite3";
import { DashboardRepository } from "../../src/db/repositories/dashboard-repository";
import { AuditRepository } from "../../src/db/repositories/audit-repository";
import { runMigrations } from "../../src/db/migrations/runner";
import { DashboardService } from "../../src/main/dashboard/dashboard-service";
import type { AgentLiveState } from "../../src/shared/schemas/agents-runtime";

function openDashboardHarness() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  const dashboardRepository = new DashboardRepository(db);
  const auditRepository = new AuditRepository(db);
  const states: AgentLiveState[] = [
    {
      agentId: "osint-agent",
      status: "working",
      task: "running Sherlock on example",
      lastRunId: "agent-run-one",
      updatedTs: "2026-08-10T10:04:00.000Z"
    },
    {
      agentId: "byte-agent",
      status: "idle",
      task: null,
      lastRunId: null,
      updatedTs: "2026-08-10T10:05:00.000Z"
    }
  ];
  const service = new DashboardService(dashboardRepository, auditRepository, { states: () => states } as never);
  return { db, service };
}

it("dashboard aggregates recent activity and active cases so home shows the investigation state", () => {
  const { db, service } = openDashboardHarness();
  db.prepare("INSERT INTO cases (id, title, status, updated_ts) VALUES (?, ?, 'open', ?)").run(
    "case-one",
    "Acme review",
    "2026-08-10T10:00:00.000Z"
  );
  db.prepare("INSERT INTO case_tags (case_id, tag) VALUES (?, ?)").run("case-one", "client");
  db.prepare(
    `INSERT INTO search_runs (id, seed_type, seed_value, started_ts, completed_ts, statuses, tree)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run("search-one", "domain", "example.com", "2026-08-10T10:01:00.000Z", "2026-08-10T10:02:00.000Z", "[]", "{}");
  db.prepare(
    `INSERT INTO agent_runs (id, agent_id, case_id, provider, model, seed_json, status, started_ts, completed_ts, error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "agent-run-one",
    "osint-agent",
    "case-one",
    "openai",
    "gpt-5.1",
    JSON.stringify({ type: "domain", value: "example.com" }),
    "succeeded",
    "2026-08-10T10:03:00.000Z",
    "2026-08-10T10:04:00.000Z",
    null
  );
  db.prepare(
    `INSERT INTO watchlist (id, type, value, case_id, check_interval_minutes)
     VALUES (?, ?, ?, ?, ?)`
  ).run("watch-one", "domain", "example.com", "case-one", 60);
  db.prepare(
    `INSERT INTO exposures (id, watch_id, source, title, detail, fingerprint)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run("exposure-one", "watch-one", "xposedornot", "Breach", "example breach", "fp-one");
  db.prepare(
    `INSERT INTO monitoring_alerts (id, exposure_id, watch_id, message, created_ts)
     VALUES (?, ?, ?, ?, ?)`
  ).run("alert-one", "exposure-one", "watch-one", "New exposure for example.com", "2026-08-10T10:06:00.000Z");

  const summary = service.summary();

  expect(summary.activeCases).toMatchObject([{ id: "case-one", title: "Acme review", tags: ["client"] }]);
  expect(summary.recentSearches).toMatchObject([{ id: "search-one", seedType: "domain", seedValue: "example.com" }]);
  expect(summary.recentAgentRuns).toMatchObject([{ id: "agent-run-one", agentId: "osint-agent", status: "succeeded" }]);
  expect(summary.agentStatus).toMatchObject({ working: 1, idle: 1, offline: 0, error: 0 });
  expect(summary.watchAlerts).toMatchObject([{ id: "alert-one", message: "New exposure for example.com" }]);
});
