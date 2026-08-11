# Planning index — read this first

Single entry point to Reacher's planning. Read in order.

## Core
1. `../CLAUDE.md` — architect memory + invariants (overrides defaults).
2. `REACHER_PLAN.md` — phased build plan (phases 0-12 + expansion 13-16).
3. `API_CATALOG.md` — free-first data sources + WSL tools + face/crypto sources.
4. `STABILITY.md` — background execution, bounded concurrency, no-crash rules.

## Build instructions
5. `codex-instructions/README.md` — how Codex works (checklist, sub-agents, audit-each-phase).
6. `codex-instructions/phase-00..12-*.md` — one file per phase.

## Feature specs
7. `SEARCH_SPEC.md` — correlation-tree search.
8. `OSINT_TOOLS.md` — quick network tools, FaceCheck.id face search, crypto/geo/QR.
9. `AGENTS_WORLD.md` + `agent-status-lines.json` — Claw3D isometric agents HQ.
10. `SURFACES.md` — Dashboard, Analyzers, Settings, Reports, Audit log.
11. `ANALYZERS.md` — full analyzers catalog.
12. `PAYLOAD_PLAYGROUND.md` — authorized offensive tooling (gated).
13. `METHODOLOGY_MAP.md` — OWASP/PTES/OSSTMM interactive flowchart.
14. `integrations/cli-osint-tools.md` + `integrations/sherlock.md` — CLI connectors.

## Agent prompts + ready prompts
15. `agent-prompts/README.md`, `osint-agent.md`, `architect-agent.md`.
16. `prompts/codex-agents-world.md`.

Connector reference code: `src/tools/` (sherlock.ts, holehe.ts, ignorant.ts),
`scripts/run-sherlock.sh`.
