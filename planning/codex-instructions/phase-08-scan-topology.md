# Phase 8 — Network scan and topology (nmap)

**Goal:** an nmap scan builder that runs through the WSL launcher, parses results,
renders an in-app topology, and exports to a report.
**Depends on:** 7, 4.
**Read first:** `CLAUDE.md`, `REACHER_PLAN.md` (Phase 8).

## Build
1. Scan builder: scan types (ping sweep, quick top-100, full TCP, service+version,
   OS detect, vuln NSE, custom), toggles, timing template.
2. Run nmap via the Phase 7 launcher with `-oX -` (XML on stdout, captured by the
   launcher — no new output-artifact concept needed). Parse XML -> hosts/ports.
3. Topology: **hand-rolled deterministic layout** — hop distance as ring index,
   seeded by a hash of the address (reactflow renders/pans, does not lay out). Two
   scans of the same target must be comparable by eye.
4. Export the host table + service list + topology into a Phase 4 report.
5. Authorization: exact-match target string (scanning `192.168.1.0/24` needs an
   auth for that literal string — no CIDR widening).

## Data / migrations
`011-scans.ts`: `scans`, `hosts`, `ports`.

## IPC channels
`scan:run` (streams `scan:output`), `scan:get`, `scan:topology`.

## Tests
- the nmap XML parser maps hosts/ports from a fixture.
- topology layout is deterministic for identical input.
- scanning an unauthorized target is refused.
- export includes the topology.

## Exit criteria (phase-audit 8)
Scan an authorized target, parse hosts, render topology, export a report
(mechanism: parser + layout; tests: "parses nmap XML", "lays out topology
deterministically", "refuses an unauthorized scan").

## Verify / Commit
`phase-audit 8`; branch `phase/08-scan-topology`; reviewer PASS.
