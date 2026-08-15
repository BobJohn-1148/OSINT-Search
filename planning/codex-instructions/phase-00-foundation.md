# Phase 0 — Foundation and app shell

**Goal:** a bootable Electron + React + TS app with SQLite migrations, the IPC
transport, the dark console theme + Reacher branding, a collapsible sidebar, all
routes as stubs, and the append-only audit skeleton.
**Depends on:** none.
**Read first:** `CLAUDE.md`, `REACHER_PLAN.md` (Phase 0).

## Build
1. Scaffold Electron main + preload + React renderer (Vite), TypeScript strict.
2. SQLite via better-sqlite3; migration runner reading `src/db/migrations/index.ts`;
   STRICT tables.
3. IPC transport: `invoke` wrapper returning `Result<T>`; channel registry in
   `src/shared/ipc.ts`; generated preload bridge from `Object.keys(IPC)`.
4. Theme: token file from `assets/brand` palette (charcoal surfaces, blue accent,
   mono for technical strings); Reacher icon set as the app/window icon.
5. Renderer shell: collapsible sidebar (persisted), nav + route stubs for
   Dashboard, Search, Cases, AI agents, Network scan, Tools, Analyzers, Reports,
   Audit log, Settings.
6. `scripts/phase-audit.mjs` with `MAX_PHASE=0` and the Phase 0 block.

## Data / migrations
`001-core.ts`: `settings(key TEXT PRIMARY KEY, value TEXT)`,
`audit_events(id, ts, actor, action, object_type, object_id, sensitivity, detail)`
— append-only via `BEFORE UPDATE`/`BEFORE DELETE` triggers that RAISE.

## IPC channels
`system:ping`, `settings:get`, `settings:set`, `audit:list`.

## Tests (write these)
- migration runner applies migrations and is idempotent on second run.
- an audit_events row cannot be updated or deleted (trigger raises).
- the IPC transport wraps a thrown handler error as a `Result` error, not a crash.
- sidebar collapse state persists across reload.

## Exit criteria (phase-audit 0)
App boots and navigates all stub routes (mechanism: navigation.ts; test:
"renders every stub route"); a stub action writes an audit event (test:
"records an audit event on ping"); theme tokens resolve (test: "no hex literals
in renderer"); audit append-only proven (test above).

## Verify
`npm run typecheck && npm run lint && npm test && npm run audit:security && node scripts/phase-audit.mjs 0`

## Commit
Branch `phase/00-foundation`; commit; run the audit; independent reviewer PASS.
