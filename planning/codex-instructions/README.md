# Codex build instructions — Reacher

You (Codex) are the implementer. Build Reacher phase by phase from the files in
this folder. One phase per branch, each independently pushable and auditable.

## Before any phase
1. Read `CLAUDE.md` (invariants — they override everything), then
   `planning/REACHER_PLAN.md` (the phase entry), then `planning/API_CATALOG.md`
   if the phase wires sources/tools, then this folder's `phase-NN-*.md`.
2. Salvaging from Dark Horse (`BobJohn-1148/Dark-Horse`, branch
   `claude/goal-ovb12a`): port the *pattern*, don't paste — it has known bugs.
   Reuse: tools-launcher gate, IPC `Result<T>`+zod, migration runner, append-only
   audit, agent provider adapters, cross-provider shared memory.

## Working model — sub-agents and parallelism
- **Fan out independent units to parallel sub-agents, then join.** Assign each
  sub-agent a *disjoint set of files* so they never edit the same file. A lead
  agent integrates and resolves conflicts.
- **Within a phase, parallelize the obvious splits:** Phase 2 = one agent per
  source connector; Phase 7 = launcher vs each catalog entry; Phase 9 = the five
  analyzers (9a–9e); Phase 4 = PDF vs Word. Shared plumbing (types, schema, IPC,
  migration) lands first on the lead branch; sub-agents build on top.
- **Across phases, run independent tracks in parallel after Phase 1:**
  Track A (search spine): 2 → 3 → 4 → 5 → 6.
  Track B (offensive): 7 → 8.
  Track C (analyzers): 9.
  Later: 10 (needs 2,3), 11 (needs 2,5,7), 12 (needs all).
- Respect the dependency table in `REACHER_PLAN.md`. Never start a phase whose
  dependencies are not merged + audited.

## Audit after EVERY phase — non-negotiable
When a phase's build is done, spawn a **fresh reviewer sub-agent with no build
context** (independent review — never let the agent that wrote the code certify
its own work). The reviewer must:
1. Run `npm run typecheck`, `npm run lint`, `npm test`,
   `npm run audit:security`, and `node scripts/phase-audit.mjs N`.
2. Confirm each exit criterion in the phase file maps to BOTH a mechanism in
   `src/` and a named test string in `tests/`.
3. Diff-review for the security invariants below, house style, theme-token-only
   colours, module headers, and behavior-sentence test names.
4. Report `PASS` or `FAIL` with specific findings. On `FAIL`, the builder fixes
   and the reviewer re-runs. **Merge/push only on PASS.** Do not begin phase N+1
   until phase N is PASS.

## Mechanical checklist (how every feature is wired)
types (`src/shared/types`) -> zod (`src/shared/schemas`, enums `as const`) -> IPC
channel block (`src/shared/ipc.ts`: request/response schema, capability,
sensitivity, `mutates`, summary; response is the success value, transport wraps in
`Result<T>`) -> migration `NNN-kebab.ts` (STRICT tables, bind 0/1 not booleans,
round floats at boundary, FTS5 triggers if searchable, register in index) ->
repository (`src/db/repositories`, only repos write SQL) -> handlers
(`src/main/ipc/handlers/<feature>-handlers.ts`, register in main) -> renderer
route + nav + components (client hooks, theme tokens only) -> tests -> phase-audit
block.

## House style
Module headers explain WHY the code is shaped this way and what breaks otherwise —
not what it does. Comments record the decision + the rejected alternative. Tests
named as behavior sentences. Sentence case in UI. No hex literals in the renderer
(theme tokens only). No emoji.

## Definition of done (every phase)
typecheck + lint + unit + integration tests green; `npm run audit:security`
passes; `node scripts/phase-audit.mjs N` passes; branch `phase/NN-slug`,
conventional commit, pushed; independent reviewer returned PASS.

## Security invariants — never weaken without a recorded decision
Passive OSINT is ungated. Active actions require an exact-match `authorizations`
record. Every sensitive action writes an append-only `audit_events` row via
trigger. API keys are read only through the vault gate. Every `spawn`/`wsl.exe`
uses a fixed argv array with `shell: false`.
