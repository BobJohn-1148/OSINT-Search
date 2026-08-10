# Phase 6 — Architect agent (Codex)

**Goal:** an in-app architect agent that knows the codebase and turns feature
requests into planned, built, tested changes behind confirm dialogs.
**Depends on:** 5.
**Read first:** `CLAUDE.md`, `REACHER_PLAN.md` (Phase 6),
`planning/agent-prompts/architect-agent.md`.

## Build
1. Wire `architect-agent` to the ChatGPT Codex provider (default; still
   switchable in Settings).
2. Repo-read tool scoped to the project; the agent reads `CLAUDE.md`, the plan,
   and named files before proposing.
3. Flow: `propose plan` -> owner confirm -> implement. Every write is behind a
   main-owned confirm dialog and audited. Shares the Phase 5 memory.

## IPC channels
`agent:architect:ask`, `agent:architect:proposePlan`, `agent:architect:apply`
(guarded by confirm).

## Tests
- the architect returns a plan that references real files in the repo.
- no write happens without an explicit confirm.
- provider/model is switchable; actions are audited.

## Exit criteria (phase-audit 6)
Architect answers a codebase question and drafts a feature plan (mechanism:
architect handler; test: "drafts a plan citing real files"); writes gated by
confirm; audited.

## Verify / Commit
`phase-audit 6`; branch `phase/06-architect-agent`; reviewer PASS.
