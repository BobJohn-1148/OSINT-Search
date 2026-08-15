# Phase 10 — Credential monitoring and scraping

**Goal:** watch emails/domains for breach exposure, recheck on a schedule, alert,
and save to a case.
**Depends on:** 2, 3.
**Read first:** `CLAUDE.md`, `REACHER_PLAN.md` (Phase 10), `API_CATALOG.md`
(Breach).

## Build
1. Watchlist of emails/domains. Check via XposedOrNot (free spine); HIBP,
   LeakCheck, DeHashed as paid key slots that skip gracefully when no key.
2. Scheduler for periodic rechecks; record new exposures; raise alerts.
3. Save exposures to a case; feed matched entities into the correlation model.

## Data / migrations
`013-monitoring.ts`: `watchlist(id, type, value, created_ts)`,
`exposures(id, watch_id, source, detail, first_seen_ts)`.

## IPC channels
`watch:add|list|remove`, `watch:checkNow`, `watch:exposures`.

## Tests
- adding a target and checking records an exposure and raises an alert.
- a scheduled recheck fires and dedupes already-seen exposures.
- a paid source with no key is skipped without error.

## Exit criteria (phase-audit 10)
Add a watch target, check, alert, save (mechanism: monitoring service; test:
"records and alerts on a new exposure"); scheduled recheck fires; paid sources
degrade gracefully.

## Verify / Commit
`phase-audit 10`; branch `phase/10-credential-monitoring`; reviewer PASS.
