# Reacher

A local-first Windows desktop app that unifies OSINT investigation, network
reconnaissance, log analysis, and AI recon agents in one dashboard. No telemetry,
no server, no multi-tenant anything — all state lives in a local SQLite database.

Architecture, phases, and data sources are documented under `planning/`; start
with `CLAUDE.md`, then `planning/REACHER_PLAN.md`.

## Running it

```bash
npm install
npm start
```

## Runtime dependencies

Reacher depends on four things that cannot ship inside the app. Without them it
still runs — a search returns whatever sources answered and the rest report as
failed — but the agent and two of the sources stay dark.

| Dependency | Enables | Install |
|---|---|---|
| Ollama + `llama3.1:8b` | Every AI agent | `winget install Ollama.Ollama` then `ollama pull llama3.1:8b` |
| WSL + Sherlock | The Sherlock source on username searches | `wsl --install -d Ubuntu`, then `pipx install sherlock-project` inside it |
| Python + `scrapegraphai` | The ScrapeGraph source on domain/business searches | `py -3 -m pip install -r requirements-scrapegraph.txt` |
| API keys | ScrapeGraph (`openai`), ripper-agent (`anthropic`) | Enter them in the app under Settings → API keys |

Check what is present at any time:

```bash
npm run doctor
```

Install the first three in one pass — from an **elevated** PowerShell, because
`wsl --install` needs administrator rights and reboots partway through:

```bash
powershell -ExecutionPolicy Bypass -File scripts/setup-runtime.ps1
```

The script is idempotent, so re-run it after the reboot to finish. It never
touches API keys: those go in through Settings so they land in the encrypted
vault rather than your shell history.

### On model choice

`llama3.1:8b` is the default because it fits in 8GB of VRAM and answers fast
enough to sit behind a search, which starts an agent run on every query.
`llama3.3` is a 70B model needing roughly 43GB — it is still selectable in
Settings for a machine with the memory for it, but it will not load on a typical
32GB desktop.

## Verification

```bash
npm run verify
```

Runs typecheck, lint, the test suite, the security audit, and the phase audit.
Each phase must pass its own audit before it counts as done:

```bash
node scripts/phase-audit.mjs <n>
```
