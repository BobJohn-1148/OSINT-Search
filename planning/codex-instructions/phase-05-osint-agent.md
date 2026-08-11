# Phase 5 — AI agent hub (OSINT agent) + shared memory

**Goal:** the OSINT agent runs an investigation with a live step log and cited
findings, switchable provider/model, writing to one shared memory store.
**Depends on:** 2, 3.
**Read first:** `CLAUDE.md`, `REACHER_PLAN.md` (Phase 5),
`planning/agent-prompts/osint-agent.md` and `README.md`.

## Build
1. Agent runtime: job queue + step loop. `STEP_FORMAT` requires all keys with
   `summary` and `next` as nullable unions (`.nullish()`) — OpenAI/xAI strict mode
   rejects a schema that declares a key it doesn't require (this was a real Dark
   Horse bug; don't reintroduce it).
2. Load the `osint-agent` prompt from `planning/agent-prompts`. Provider/model per
   the Phase 1 selection.
3. Run view events: stream `agent:step` and `agent:finding`; loading animation;
   run history / previous runs.
4. Shared memory: `agent_memory(scope, key, value, source_agent, cited_run,
   confidence, ts)` — every agent reads on start, appends on finish, regardless
   of provider.
5. Enforce the cited rule: a finding without a source is rejected; grade derived.
6. Send-to-agent from Search (hand off a seed or a data point).

## Data / migrations
`009-agents-runtime.ts`: `agent_runs`, `agent_steps`, `agent_memory`.

## IPC channels
`agent:run` (streams `agent:step`, `agent:finding`), `agent:runs`,
`agent:memory:list`.

## Tests
- `STEP_FORMAT` parses a step with null `summary`/`next`.
- memory written by agent A is readable by agent B on a different provider.
- a finding without a source is rejected.
- run history persists and reloads.

## Exit criteria (phase-audit 5)
Run the OSINT agent on a seed with streamed steps (mechanism: agent loop; test:
"streams steps and cited findings"); findings saved to case + memory; shared
memory readable cross-provider (test above); cited rule enforced.

## Verify / Commit
`phase-audit 5`; branch `phase/05-osint-agent`; reviewer PASS.
