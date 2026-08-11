# Phase 2 — Search core and correlation engine (passive)

**Goal:** one seed in, one merged scored profile out — sources fan out in
parallel, stream in live, and merge into a correlation tree with corroboration
strength.
**Depends on:** 1.
**Read first:** `CLAUDE.md`, `REACHER_PLAN.md` (Phase 2), `API_CATALOG.md`,
`planning/SEARCH_SPEC.md`.

## Build
1. `SourceConnector` interface: `{ id, category, tier:'passive', keyRequired,
   supports(seedType), run(seed): Observation[] }`. One file per connector —
   **parallelize across sub-agents.**
2. Orchestrator: fan out to all connectors supporting the seed type; emit a
   `search:source-returned` event as each returns; isolate failures (one bad
   source never kills the run).
3. Correlation: extract entities; link identical entities across sources; compute
   strength = count of distinct sources (1 single-source, 2 likely, 3 strong,
   4+ confirmed) — computed, never typed.
4. Tree model (root=seed, children=sources, leaves=data points) + "search
   further" pivots (a data point becomes a new seed).
5. Renderer: time-of-day greeting ("Good morning/afternoon/evening, sir"),
   launch/loading animation, live-arriving file-tree, strength meter, clickable
   entities that trace through the tree.

## Data / migrations
`004-sources.ts` (registry), `005-observations.ts`
(`observations(id, run_id, entity, type, value, source, confidence)`,
`entity_links(entity_a, entity_b, run_id)`), `006-search-runs.ts`.

## Sources to wire (free spine, HTTP/passive)
RDAP/WHOIS, DNS/DoH, crt.sh, Shodan InternetDB, ipinfo, AbuseIPDB, XposedOrNot,
macvendors, NVD. (Self-run tools like theHarvester/Holehe come via the Phase 7
launcher; keep Phase 2 to HTTP APIs.)

## IPC channels
`search:run` (streams `search:source-returned`, `search:observation`),
`search:pivot`, `search:get`.

## Tests
- two sources returning the same entity raise its strength band.
- the tree builds correctly from a fixture set of observations.
- scoring bands map 1/2/3/4+ correctly.
- a failing connector is isolated; the run still completes.
- arrival events stream per source.

## Exit criteria (phase-audit 2)
Search runs with live source arrival (mechanism: orchestrator; test: "streams a
source-returned event per source"); overlaps score by corroboration (test:
"promotes a 3-source entity to strong"); nodes save-able; connector interface
documented.

## Verify / Commit
`phase-audit 2`; branch `phase/02-search-correlation`; reviewer PASS.
Parallelize: assign each connector to a sub-agent with a disjoint file set.
