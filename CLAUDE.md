# Reacher — architect memory

This file is the architect's memory for Reacher. It overrides default behaviour.
Read it first, then `planning/REACHER_PLAN.md` (the phases) and
`planning/API_CATALOG.md` (the data sources) before touching code.

## What Reacher is

A personal, single-user Windows desktop app for one person (Jack) that unifies
OSINT investigation, network reconnaissance, log analysis, and AI recon agents in
one dashboard. It is an all-in-one OSINT + cybersecurity tools hub. Local-first,
no telemetry, no server, no multi-tenant anything.

Formerly written up as "REACH"; the product name is **Reacher** (top-hat
investigator mascot, John the Ripper lineage — see `assets/brand/`).

## Prime directive

Do not cut corners. Utmost quality. This is a tool Jack relies on, so correctness,
citations, and auditability matter more than shipping fast. When a shortcut and
the right build diverge, build it right.

## Shape and stack

- **Electron + React + TypeScript**, local-first. Chosen so we can salvage the
  Dark Horse codebase directly and because it is the right fit for a Windows
  desktop app that also shells out to WSL.
- **SQLite via better-sqlite3**, STRICT tables, numbered migrations. All state is
  local and durable.
- **IPC**: every channel declares a zod request/response schema, a capability, a
  sensitivity, whether it mutates, and a summary. The transport wraps success
  values in `Result<T>`.
- **WSL launch model**: external tools (nmap, reconftw, maigret, tshark, etc.)
  run in WSL, launched from the Windows app via `wsl.exe -d <distro> -- <argv>`
  with a **fixed argv array and `shell: false`**. Output is captured to a run row
  and can be attached to a case. `wevtutil.exe` (evtx) runs the same way on the
  Windows side.

## Core product principles — these are invariants

1. **Correlation, not search.** Search takes one seed and returns one merged,
   scored profile — never a page of ranked blue links. All sources fan out in
   parallel, stream in as they return, and merge into a hierarchical tree
   (root = seed, children = sources, leaves = data points).
2. **Cited observations first, derived summary on top.** Every claim links to at
   least one source. A summary may only reference cited observations. Confidence
   is *computed* from how many independent sources corroborate a data point
   (1 = single-source, 2 = likely, 3 = strong, 4+ = confirmed) — never typed.
3. **Save to case, everywhere.** Any result, node, scan, agent finding, or tool
   run can be saved to a case. Nothing an investigator produces should be
   un-saveable.
4. **Append-only audit log.** Every sensitive action (key access, active scan,
   tool launch, export, agent run) writes an audit event via trigger. Historical
   rows are never rewritten.
5. **API-key vault.** All third-party keys live in an encrypted-at-rest local
   store, accessed through one gate, audited on read.
6. **Agent hub + shared memory.** Agents are versioned prompt files
   (`planning/agent-prompts/`). Each agent's provider and model are switchable at
   runtime (OpenAI, xAI Grok, Anthropic, local Ollama/LM Studio). All agents read
   and write ONE shared memory store regardless of provider.
7. **Authorization gate on active actions.** Passive OSINT is ungated. Anything
   active (port scans, active recon tools, exploitation) requires a
   target-authorization record whose target string matches exactly. This is
   Jack's legal protection, configurable per phase — not an AI guardrail.
8. **Collapsible sidebar** and consistent dark console theme across every surface.

## Identity

Name: Reacher. Mascot: pixel-art top-hat gentleman with glowing eyes (accent
build) / black silhouette (mono build) in `assets/brand/`. Theme: dark security
console — charcoal surfaces, blue accent, monospace for technical strings
(IPs, hashes, commands). Sentence case everywhere.

## Salvage from Dark Horse

Dark Horse (private repo `BobJohn-1148/Dark-Horse`, branch `claude/goal-ovb12a`)
is not worth keeping wholesale, but its proven patterns are: the tools-launcher
gate, IPC `Result<T>` + zod, migration system, append-only audit, agent
provider adapters, and cross-provider shared agent memory. Port these rather than
reinventing. **Needs a read-scoped GitHub token to access** — none is wired yet,
and there is no local copy under the user folder.

## House style — match it or the diff looks foreign

- Every module opens with a prose header explaining **why it is shaped this way
  and what breaks otherwise**, not what it does.
- Comments record the decision and the rejected alternative, with the reason.
  Never restate the code. No emoji.
- Tests are named as sentences stating the behaviour and why it matters.
- A decision lives in the code, the test, and the comment — all three move
  together.
- Renderer: never a raw hex or stock colour; everything resolves to a theme token.

## Adding a feature — mechanical checklist

1. Types in `src/shared/types/`, zod in `src/shared/schemas/` (enums as `as const`).
2. A channel block in `src/shared/ipc.ts` (request/response schema, capability,
   sensitivity, `mutates`, summary).
3. Migration `NNN-kebab-name.ts`, STRICT tables, registered in the migration index.
   Bind `0`/`1` not booleans; round floats at the boundary; FTS5 triggers if
   searchable.
4. Repository in `src/db/repositories/` — only repositories write SQL.
5. Handlers `src/main/ipc/handlers/<feature>-handlers.ts`, registered in main.
6. Renderer route + nav entry; components use the client hooks, not the raw bridge.
7. Tests in `tests/unit/` and `tests/integration/`.
8. A phase-audit block pinning each exit criterion to both a mechanism in `src/`
   and a named test string in `tests/`.

## Verification

`npm run typecheck` · `npm run lint` · `npm test` · `npm run verify` ·
`npm run audit:security` · `node scripts/phase-audit.mjs <n>`. Each phase must
pass its own phase-audit before it is considered done.

## Scope and safety stance

OSINT agent prompts are written lean, without generic model refusals, so they
actually investigate. The kept constraint is lawful, open-source collection on
owned or authorized targets, plus the authorization gate on active actions. Do
not build features whose primary purpose is stalking/harassing private
individuals or intruding on systems the owner is not authorized to test.

## Stability and performance (invariant)
Tool runs execute in the background (main process/worker), never on the UI thread. Fan-out is bounded by a job queue; streamed results are batched to the renderer; output is capped and killable; the tree is virtualized. A search that floods thousands of results must throttle, not crash. Full spec: `planning/STABILITY.md`.
