# Phase 9 — Analyzers

**Goal:** five in-app analyzers, each saving findings to a case/report.
**Depends on:** 4. (Largely independent — build the five in parallel sub-agents.)
**Read first:** `CLAUDE.md`, `REACHER_PLAN.md` (Phase 9), `API_CATALOG.md`
(Vulnerability, MAC).

## Build (parallelize 9a-9e across sub-agents; disjoint files)
- **9a Windows Event Log:** import `.evtx` via `wevtutil.exe` with fixed argv,
  `shell: false`; parse events; filter by level/source/id.
- **9b PCAP:** import `.pcap/.pcapng` via `tshark` through the launcher — **file
  import only, no live capture** (live capture needs Npcap + an elevated helper;
  out of scope by decision). Summaries + conversation/stream view.
- **9c Google dork generator:** templates -> query strings for a target; no
  network calls; copy/open.
- **9d MAC OUI lookup:** bundle the IEEE OUI DB for offline lookups; macvendors
  API fallback (free, 1000/day).
- **9e Vulnerability lookup:** product + version -> CVEs via NVD (free API);
  cache results. Example input: "Cisco Catalyst 3750-E".

## Data / migrations
`012-analyzers.ts`: `evtx_imports`, `pcap_imports`, `vuln_cache`; bundle OUI data
as a read-only asset.

## IPC channels
`analyzer:evtx:import`, `analyzer:pcap:import`, `analyzer:dork:build`,
`analyzer:mac:lookup`, `analyzer:vuln:lookup`.

## Tests
- evtx parser reads a fixture and filters by event id.
- pcap parser reads a fixture; there is NO live-capture code path.
- dork builder emits expected query strings.
- MAC -> vendor resolves offline.
- product+version -> a CVE list from NVD (mocked in test).

## Exit criteria (phase-audit 9)
Each analyzer imports/parses and saves (mechanisms + one named test each);
vuln lookup maps a product to CVEs; no live-capture path exists.

## Verify / Commit
`phase-audit 9`; branch `phase/09-analyzers`; reviewer PASS.
