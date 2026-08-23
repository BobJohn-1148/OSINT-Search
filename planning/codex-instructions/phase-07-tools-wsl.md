# Phase 7 — Tools hub and WSL launcher

**Goal:** a catalog of OSINT/security tools, each with description + install +
link + tier, launchable in WSL with output captured to a case.
**Depends on:** 1. (Independent of the search spine — build in parallel.)
**Read first:** `CLAUDE.md`, `REACHER_PLAN.md` (Phase 7), `API_CATALOG.md` (Tools).

## Build
1. Launcher: `wsl.exe -d <distro> -- <argv>` with a **fixed argv array and
   `shell: false`**. Capture stdout/stderr to a `tool_runs` row; stream output to
   the UI; attach a run to a case.
2. Catalog seed from `API_CATALOG.md` (reconFTW, Argus, Maigret, Blackbird,
   Photon, theHarvester, Sherlock, PhoneInfoga, SpiderFoot, nmap, tshark) with
   description, install command, official link, category, tier. **Parallelize:
   launcher on the lead branch; one sub-agent per batch of catalog entries.**
3. Detect installed tools (`which` in WSL). Add/edit a catalog entry in-app.
4. Active-tier tools require an `authorizations` record for the target.

## Data / migrations
`010-tools.ts`: `tool_catalog`, `tool_runs`, `authorizations(id, target, tier,
created_ts, expires_ts)`.

## IPC channels
`tools:list|detect`, `tools:launch` (streams `tools:output`), `catalog:add|update`,
`auth:create|list`.

## Tests
- the launcher builds a fixed argv and never invokes a shell.
- an active tool is blocked without a matching authorization.
- tool output is captured to a run and attachable to a case.
- catalog add/edit persists.

## Exit criteria (phase-audit 7)
Launch a passive tool in WSL and capture output (mechanism: launcher; test:
"captures WSL tool output to a run"); active tools gated by authorization (test
above); catalog editable.

## Verify / Commit
`phase-audit 7`; branch `phase/07-tools-wsl`; reviewer PASS.
