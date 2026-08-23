# Codex build instructions — consolidate real agent execution into canonical

Read `CLAUDE.md` first, then this file. Run this **before** the voxel-art HQ
overhaul brief in this same folder — this fixes function, that fixes looks, and
there's no point polishing a scene that sits on top of agents that don't
actually run.

## Why this exists

This repo is the canonical, single source of truth for Reacher (see
`RETIRED-CANONICAL-IS-DOWNLOADS.md` if present, or ask Jack — a retired branch
of this codebase previously lived at `C:\Users\bob10\Desktop\OSINT-Search` and
must not be launched or edited). A git baseline was just committed here
(`git log -1` should show "Baseline snapshot of canonical Reacher before Codex
consolidation work") specifically so this change is diffable and reviewable.

Independent investigation of both this repo and the retired one turned up the
same root bug, found and partly fixed twice, in two different ways:

- **This repo (canonical)** has `src/db/migrations/021-free-osint-ai.ts`,
  which correctly repoints `osint-agent`, `ripper-agent`, and
  `malware-analyst-agent` from `openai` to `ollama` — but **that's a data-layer
  fix only.** `src/main/agents/agent-runtime-service.ts` still builds every
  step and finding from hardcoded template strings (`buildSteps`,
  `createCitedFinding`) and never calls any model, real or otherwise. Pointing
  an agent at Ollama does nothing if nothing ever calls Ollama.
- **The retired copy** built the actual fix: a real `ChatProvider`
  abstraction, a rewritten `AgentRuntimeService` that sends each agent's real
  prompt file plus live context to the model and parses its real JSON
  response, in-code citation-integrity enforcement (a model can't claim a
  source that wasn't actually in the context it was given), and full test
  coverage for all of it. That work needs to move here — adapted to this
  repo's actual schema and agent roster, not pasted in verbatim.

## Step 1 — find out what's actually here before changing anything

Do not assume the retired copy's agent roster matches this one. Run:
```
SELECT id, name, provider, model, prompt_path, reasoning_effort FROM agents;
```
against this repo's own dev database (or read the full migration history:
`003-agents.ts`, `009-agents-runtime.ts`, and anything after `009` that touches
`agents`) to get the real, current list. As of this writing that list is known
to include `architect-agent`, `osint-agent`, `ripper-agent`,
`malware-analyst-agent`, `scout-agent`, and `byte-agent` (six agents, confirmed
via the live Dashboard's fleet panel) — but confirm rather than trust this
brief, since it was written from source reading, not a live query, and this
repo moves independently of whoever wrote this file.

## Step 2 — port the chat-provider layer (straightforward, low risk)

Retired's `src/main/providers/chat-providers.ts` is self-contained (imports
only `../../shared/types/providers.js` and `../search/http.js`, both of which
exist here too). Port it directly:
- `ChatProvider` interface, `OllamaChatProvider` (POSTs to
  `http://127.0.0.1:11434/api/chat`, `format: "json"`, its own ~120s
  `AbortController` timeout — chat completions are much slower than the
  diagnostics probes elsewhere in this codebase), `UnavailableChatProvider`
  (fails loudly for any provider without a real call — do not let it fall back
  to fake text, that's the exact bug being fixed), `ChatProviderResolver`.
- Confirm this repo's `fetchJson`/`asRecord` in `src/main/search/http.ts` match
  the signatures the provider expects; adapt if this repo's version has
  diverged.
- Port `tests/unit/chat-providers.test.ts` directly — it mocks `global.fetch`,
  no repo-specific dependencies.

## Step 3 — merge (not overwrite) the real execution logic into `AgentRuntimeService`

This is the part that needs judgment, not a file copy — this repo's
`agent-runtime-service.ts` has almost certainly evolved independently since the
retired copy forked. Read both versions and merge:

- Replace `buildSteps`/`createCitedFinding` with real model calls: build
  context from recent shared memory (`runtimeRepository.listMemory`) and the
  case's existing evidence (`casesRepository.timeline`), send the agent's own
  prompt file as system context, parse the model's JSON response against a
  narrow local schema (steps + finding, no `runId`/`agentId`/`id` — those are
  filled in after parsing, not asked of the model).
- **Citation-integrity enforcement in code**: build a citation map from
  exactly what was fed to the model (`seed:...`, `memory:...`, `case-item:...`
  keys); filter every `sources[]` the model returns against that map; if a
  finding ends up with zero grounded sources, fail the run with a clear error
  instead of saving an uncited claim. This is the mechanism that makes "never
  states a thing he cannot cite" (osint-agent's own tagline) actually true
  instead of aspirational.
- One retry on malformed JSON (feed the parse error back to the model), then
  fail the run with a real message — never fall back to a template.
- Preserve whatever this repo's `AgentRuntimeService` already does beyond what
  the retired copy had (e.g. anything related to `reasoning_effort` — see
  Step 5). Don't regress existing behavior to match an older fork.
- Merge, don't replace, `tests/unit/agent-runtime.test.ts` the same way: keep
  every existing test in this repo's version, add a `RecordingChatProvider`
  test double (mirrors this repo's own `RecordingArchitectProvider` pattern
  already used for architect-agent, if that pattern still exists here), and add
  tests for: real content comes from the provider not a template; an
  ungrounded citation is rejected; an unwired provider fails the run instead of
  faking success; malformed JSON retries once then fails.

## Step 4 — fix the remaining half of the free-provider gap

Migration 021 covers `osint-agent`, `ripper-agent`, `malware-analyst-agent` —
it does not mention `scout-agent` or `byte-agent`. If those two are still
seeded on `openai` (check Step 1's query), add a new migration (next id after
whatever this repo's highest current migration number is — do not reuse 021 or
any other already-shipped id) that repoints them to `ollama`/`llama3.3` the
same way, matching migration 021's own idempotent `WHERE provider = 'openai'`
guard so a deliberate manual override in Settings is never clobbered. Leave
`architect-agent` alone — both this repo and the retired one independently
agreed it stays on its coding-model default, and its own prompt file documents
that as intentional.

If `scout-agent` and/or `byte-agent` don't yet have their own prompt files
(check `planning/agent-prompts/` — this repo currently has
`architect-agent.md`, `malware-analyst.md`, `osint-agent.md`,
`ripper-agent.md`, but no `scout-agent.md`/`byte-agent.md`), port and adapt the
retired copy's versions of those two rather than leaving them pointed at
another agent's prompt as a placeholder.

## Step 5 — respect `reasoning_effort`, don't break it

This repo has a column and UI concept the retired copy never had:
`agents.reasoning_effort` (migration `020-agent-reasoning-effort.ts`,
`reasoningEffort` in the zod schema and repository). Ollama has no equivalent
parameter — find wherever this repo currently surfaces that (a screenshot from
this session showed literal UI text "Ollama has no reasoning-effort control"
under an agent's mission-brief field) and make sure the merged
`AgentRuntimeService` still behaves consistently with that messaging: don't
silently pass a reasoning-effort value to `OllamaChatProvider` and don't break
whatever currently disables/greys out that control for Ollama-backed agents.

## Do NOT do these

- Do not delete or edit the retired copy at
  `C:\Users\bob10\Desktop\OSINT-Search`. When this work is verified complete,
  stop and report back — a final side-by-side check happens before anyone
  deletes anything, not automatically at the end of this task.
- Do not reuse a migration id or filename that already exists in this repo's
  `src/db/migrations/` (currently through `024`). Check `src/db/migrations/index.ts`
  for the real current max before picking a number.
- Do not touch `architect-agent`'s provider/model.
- Do not start the voxel-art HQ overhaul (the other brief in this folder)
  until this one is verified done.

## Definition of done

- `npm run typecheck && npm run lint && npm test && npm run audit:security &&
  node scripts/phase-audit.mjs 14` (or whatever the current phase number is —
  check `scripts/phase-audit.mjs`'s `MAX_PHASE`) all green.
- Live smoke test: with Ollama installed and `llama3.3` pulled, run each of the
  six agents from the Dashboard/AI agents view against a real seed and confirm
  the resulting memory entries are genuinely distinct per agent (this was the
  original, repeatedly-raised complaint this whole effort traces back to — the
  fix isn't done until that's visibly true, not just unit-tested).
- `git diff` against the baseline commit is reviewable — a human (or Claude,
  auditing on Jack's behalf) should be able to read the diff and see exactly
  what changed and why, matching this repo's own house style: module headers
  explain why, not what; comments record the decision and the rejected
  alternative.
- Report back explicitly rather than silently continuing to the next brief —
  Jack asked for this to be guided and audited step by step, not run
  unattended end to end.
