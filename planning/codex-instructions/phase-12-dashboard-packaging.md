# Phase 12 — Dashboard, audit review, packaging

**Goal:** the home dashboard, an audit log viewer, settings polish, and a
packaged Windows build.
**Depends on:** all prior phases.
**Read first:** `CLAUDE.md`, `REACHER_PLAN.md` (Phase 12).

## Build
1. Dashboard: recent activity, active cases, quick search, agent status, watch
   alerts.
2. Audit log viewer with filters (type, date, target, sensitivity).
3. Settings polish (keys, providers per agent, WSL distro, shared-memory config).
4. Package with electron-builder; Reacher icon set; Windows installer. Perf pass.

## IPC channels
`dashboard:summary`, `audit:query`.

## Tests
- dashboard aggregates recent activity and active cases.
- audit query filters by type/date/target.
- (packaging smoke test may require a packaged environment — mark clearly.)

## Exit criteria (phase-audit 12)
Dashboard live (mechanism: dashboard handler; test: "aggregates recent activity");
audit filterable (test: "filters audit by type and date"); packaged build runs;
final full audit across phases passes.

## Verify / Commit
`phase-audit 12`; branch `phase/12-dashboard-packaging`; reviewer PASS.
