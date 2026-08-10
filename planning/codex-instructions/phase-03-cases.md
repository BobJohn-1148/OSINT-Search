# Phase 3 — Cases and evidence system

**Goal:** anything an investigator produces can be saved to a case; a case shows
an evidence timeline and a live summary.
**Depends on:** 2.
**Read first:** `CLAUDE.md`, `REACHER_PLAN.md` (Phase 3).

## Build
1. Case CRUD + tags + status.
2. Polymorphic `case_items` (observation | scan | tool_run | agent_run | note |
   report). Save-from-search wired into the Phase 2 UI.
3. Evidence timeline (chronological). Case summary: counts + key entities ranked
   by strength (reuse Phase 2 scoring).
4. FTS5 over case items for full-text search within a case.

## Data / migrations
`007-cases.ts`: `cases`, `case_items` (polymorphic ref), `case_tags`; FTS5 virtual
table + triggers over item text.

## IPC channels
`cases:create|list|get|update`, `case:addItem`, `case:timeline`, `case:summary`,
`case:search`.

## Tests
- an observation saved from search appears in the case timeline.
- timeline is ordered by time.
- summary aggregates key entities by strength.
- FTS finds a saved value by substring.

## Exit criteria (phase-audit 3)
Create case + save from search (mechanism: case repo; test: "saves a search
observation to a case"); timeline renders ordered; summary computes; FTS works.

## Verify / Commit
`phase-audit 3`; branch `phase/03-cases`; reviewer PASS.
