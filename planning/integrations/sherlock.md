# Integration — Sherlock on username search

When a search runs with a `username` seed, Reacher auto-fans-out to Sherlock along
with Maigret and Blackbird. Results stream into the correlation tree; any hit
corroborated by another source is promoted by the strength meter.

- WSL, Phase 7 launcher, fixed argv, `shell:false`.
- Argv: `sherlock <username> --print-found --timeout 20 --csv --folderoutput <run-tmp>`.
- Live: parse `^\[\+\]\s+(.+?):\s+(https?://\S+)$` into observations
  (`type: profile`, `source: sherlock:<site>`); emit is batched (see STABILITY.md).
- Artifact: keep `<run-tmp>/<username>.csv`, attach to the case.
- Passive tier — no authorization needed. Install once: `pipx install sherlock-project`.
- Files: `src/tools/sherlock.ts` (app), `scripts/run-sherlock.sh` (manual/WSL).
