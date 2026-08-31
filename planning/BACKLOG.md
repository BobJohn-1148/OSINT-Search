# Reacher — standing backlog

Read this alongside `CLAUDE.md` at the start of a session. It tracks what's
actually outstanding right now, not the phase history (`REACHER_PLAN.md` is
for that). Update it as items get fixed or new ones surface — don't let it
go stale.

**Active branch: `working`.** `main` is frozen at its 2026-08-24 pushed state
on purpose. Commit and push to `working` until Jack says otherwise.

## Open bugs (reported, real, not yet fixed)

### "Watch `<uuid>` does not exist" — root cause was staleness, not a live re-firing bug
Turned out not to be what it looked like: `dashboard-view.tsx`'s `status`
banner was a one-shot React state with no auto-clear, so a failed action's
error message from hours earlier just sat there indefinitely if the Electron
window stayed open on the Dashboard route without triggering another action —
reading as a live problem long after the actual watch-id mismatch that
caused it. Fixed with `announceStatus()`, which clears the banner back to
"Monitoring ready" after 12s. The underlying `Watch ${id} does not exist`
condition itself (`monitoring-service.ts`'s `checkNow`) is a real, correct
guard against a stale client-side watch reference — not itself a bug.

## Needs a product decision, not a fix

### "Remove the observations, show the actual data" — scope still unclear
Built `scripts/verify-search-live.mjs` (a standing dev script, committed)
that prints full raw data from a live search run outside the app. Not
touched: the app's own Search page still shows an "X observations: Y sources
returned / Z failed" summary line (`src/renderer/components/search-view.tsx`
~line 452, and a similar line ~676). Deliberately left alone rather than
guessed at, since changing app-facing copy on a guess risks doing the wrong
thing. If Jack meant the in-app wording too, say so specifically and it's a
quick copy change.

## Discovered, not yet actioned

### The malware-analyst agent is configured but never actually runs
`malware-analyst-agent` has a real seeded row (`agents` table, migration 018;
provider moved to a free runtime by migration 021), a real prompt
(`planning/agent-prompts/malware-analyst.md` — "cited observations, then a
derived verdict," same discipline as the OSINT agent's own prompt), and it is
selectable/configurable in Settings like every other agent. But nothing ever
calls it: `analyzers-view.tsx`'s "Malware triage" button only invokes
`analyzer:malware:triage`, which runs `malware-triage.ts`'s deterministic
static pipeline (hashes, PE header, entropy, IOC extraction, an explainable
additive risk score) and stops there. Jack can pick a provider/model for
"Malware analyst" in Settings and reasonably believe it does something; it
never gets invoked. Different from the OSINT/architect bug this session
mostly fixed (those agents ran and returned fake output) — this one just
never runs at all.

Not the same shape as pattern-agent to bolt on quickly: it would need the
static triage report turned into cited context (same citation-map discipline
as everywhere else — hash, section, import, string, IOC as citable keys), a
real `provider.complete()` call producing a grounded verdict, a decision on
whether the LLM pass is automatic after every triage or a separate opt-in
action, and where the verdict lives (a new field on the existing
`analyzer:malware:triage` response, or its own case_items entry like
pattern_finding). Flagged here rather than started — real feature-sized job,
found while auditing for the same "agent configured but never really wired
up" pattern that's been this session's throughline, not something to build
without checking scope/intent first.

## Recently completed (context for what NOT to redo)

- Added a case-scoped pattern-analysis agent (`pattern-agent`) that looks
  across a case's already-saved evidence for recurring identifiers, temporal/
  geographic clusters, and contradictions -- never a new fact, only
  connections between what is already cited. It doesn't fit
  `agentSeedSchema`'s closed seed-type enum (seeded by a whole case, not one
  entity), so it gets its own `pattern:run`/`pattern:list` request shape and
  `PatternAnalysisService`, but reuses everything else: findings are ordinary
  `case_items` rows (no new table -- migration 028 widens the `item_type`
  CHECK via the same rename/rebuild/copy migration 016 used, rebuilding the
  FTS5 index and triggers too), and provenance/shared memory piggyback on a
  real `agent_runs` row the same way `architect-agent-service.ts` already
  does for a request that isn't seed-shaped. Applied the citation-grounding
  fix from architect-agent-service.ts (drop a finding outright once every one
  of its ids is invented, don't keep it empty) from the start instead of
  waiting to rediscover the same bug live, and extracted the OSINT agent's
  citation-array parser (`model-citation-field.ts`) so both agents share one
  proven defense against a small model's comma-joined-string/`KEY="..."`
  mistakes instead of two copies. UI: a "Pattern analysis" card in the case
  workspace with clickable citation chips that jump to the named evidence.
  Verified live against a real running Ollama: correctly found both a real
  recurring identifier and a real contradiction across a 3-item test case,
  zero ungrounded citations.

- `phase-audit.mjs` phases 5, 11, 12, and 13 reconciled against the current
  UI. Nearly all of it was audit-script staleness from the pre-branch HQ /
  search / social / dashboard redesigns, fixed the same way phases 4 and 6
  were (repoint the pinned string at the real mechanism, with a comment):
  - **Phase 13** — social route dropped the literal "Social analyzer" heading
    when it was reshaped to mirror OSINT search; still owns `social:analyze`
    and the phase-15 `social:verify`. Pure repoint.
  - **Phase 12** — the `"tools.wslDistro"` literal moved into
    `src/shared/types/tools.ts` as `WSL_DISTRO_SETTING_KEY` (so the launcher
    and the settings form share one key); the WSL-distro field itself never
    left settings-view. Pure repoint.
  - **Phase 11** — "Browse image" + "Search image" collapsed into one "Attach
    image for reverse search" control (`system:pickImage` → `search:image`);
    "Username sweep" stopped being a button because a username seed now fans
    out through the Sherlock connector inside the unified `search:run`. Pure
    repoint (the `search:usernameSweep` service + its test are still there).
  - **Phase 5** — the HQ "Agents list fallback" panel became a permanently
    mounted operations console gated by `canInitializeWebGl`; the four old
    scene tests are covered by `agents-view.test.tsx`'s WebGL-fallback test
    plus a new `tests/unit/camera-controls.test.ts` pinning the camera
    contract (hint list + `focusAgentCamera`).
  - **Phase 5, real bug** — `agents-view.tsx` hard-coded `cleanIdleStatuses:
    true`, so the "Clean idle statuses" Settings toggle (AGENTS_WORLD.md §31)
    wrote a value nothing read and the coarser idle lines never showed. Fixed:
    the den now reads `agents.cleanIdleStatuses` on load, matching
    settings-view's own default (unset = show everything).
  - **Phase 12, real gap** — the dashboard genuinely lost its "Quick search"
    card in the monitoring-wall redesign (REACHER_PLAN.md phase 12 lists it,
    and the `.dashboard-quick-search` CSS was still sitting unused). Restored
    as a compact card that hands a typed seed to `/search` via the same
    router-state handoff analyzers-view uses for IOC pivots.

- The Architect agent ran on `CodexArchitectProvider`'s string-interpolated
  output, never a real model call — the same class of bug the OSINT runtime
  agents were rewritten to fix earlier, just never applied to the code-planning
  agent. Fixed: `architect-agent-service.ts` now calls a real model through the
  same `ChatProviderResolver` the OSINT agents use (`architect-chat-provider.ts`
  deleted outright, not deprecated); migration 027 moves the agent off the
  dead `openai`/`codex` seed onto a runnable `ollama`/`llama3.1:8b` default,
  matching migration 026's pattern of never clobbering a deliberately-chosen
  provider. `proposePlan()` reuses the same citation-grounding discipline
  `agent-runtime-service.ts` applies to OSINT findings: a step whose files
  were all invented is dropped, not trusted. Two real bugs only surfaced by
  live-running `ask()`/`proposePlan()` against a real local Ollama (not just
  the mocked test suite): (1) `OllamaChatProvider` hardcoded `format: "json"`
  on every call, so `ask()`'s plain-prose prompt fought JSON mode and the
  model answered literally `"{}"` — fixed with an `expectJson` field on
  `ChatCompletionRequest`, defaulting to the old JSON-mode behavior so every
  existing caller (OSINT agents) is unaffected, with `ask()` the one caller
  that opts out; (2) a plan step whose files were all invented ended up with
  an empty-but-present `files` array after grounding, which crashed
  `architectProposalSchema`'s own per-step `min(1)` on the very next line —
  fixed by dropping the whole ungrounded step instead of keeping it empty.
  Verified against a real running Ollama (`llama3.1:8b`): `ask()` returned a
  genuine sentence, `proposePlan()` returned a 3-step plan with zero
  ungrounded file citations.
- Built a real xAI Grok provider directly against xAI's own OpenAI-compatible
  REST endpoint (`XaiChatProvider` in `chat-providers.ts`) rather than the
  puter.com proxy tutorial that was floated and rejected (routes through a
  third party, browser-only library, no local-first guarantee). Live curl
  testing against the real API caught two wrong assumptions in the
  pre-existing code: the seeded model ids `grok-4.1`/`grok-4.1-fast` are
  retired (confirmed via `docs.x.ai` and a live "model not found" response),
  moved to `grok-4.6`/`grok-4.3`; and xAI's error body is a plain string
  (`{"error": "..."}`), not OpenAI's nested `{"error":{"message"}}` shape.

- Mobile device detection never persisted or audited a snapshot — fixed
  (`MobileRepository`, `mobile.detect` audit event, "Detection history" panel).
- PDF export silently dropped Cyrillic/Greek/Vietnamese text — fixed (Noto
  Sans embedded, verified with a real Cyrillic round-trip through a real PDF
  parser). CJK/Arabic deliberately out of scope (separate, much larger fonts).
- Social analyzer's status was permanently stuck on `"candidate"` — real
  verification built against each network's actual WhatsMyName exists/missing
  detection rule (not a naive "HTTP 200" guess), verified against real live
  sites.
- DNS-over-HTTPS lost all 5 record types if any single one failed — fixed
  with `Promise.allSettled`, verified against the real Cloudflare endpoint.
- `activeCaseId` "race" in `search-handlers.ts` — investigated and confirmed
  **not** a real bug (Node's single-threaded event loop can't interleave the
  synchronous `list()`/`create()` calls involved); a regression test was
  added instead of a fix, since there was nothing to fix.
- Provider "Test" status dots reset to grey/red on every app restart — fixed,
  persisted via one settings row per provider/key id
  (`providers.diagnostics.<id>`), clears on key revocation.
- Mission brief textarea was one shared string for every agent — fixed, now
  keyed per agent id with a persona-derived default per agent
  (`src/renderer/components/agents-view.tsx`).
- GitHub repo history cleanup: `main` had no common ancestor with local
  history (a stale early "sync" commit); merged non-destructively
  (`--allow-unrelated-histories`, local content kept), and 4,474
  accidentally-committed `.claude/` skill-package files were untracked.
- 15 stale `phase/*` branches deleted from the remote; `working` created from
  `main` as the new active branch (2026-08-24).
- "Watch `<uuid>` does not exist" recurring banner — see above, fixed.
- Floating "+ Add watch" header button — root cause was `.section-title-row-wide`
  having no CSS rule at all (used in 21 places across 9 components, silently
  falling back to a fixed 36px trailing column). Fixed with the missing rule
  (`minmax(0, 1fr) auto`); verified via computed layout that "Add watch" now
  renders on 1 line instead of 2.
- OSINT agent citation-format failures on IP-seed runs (2 of 3 live attempts
  failed) — two real causes found via live repro with raw-response logging:
  a model sending "sources" as a comma-joined string instead of a JSON array
  (schema now normalizes it), and the citation-list prompt format being
  genuinely ambiguous about where a key ends and its description begins
  (reformatted to an unambiguous "key | description" separator). 10
  consecutive live IP-seed runs succeeded after both fixes, versus 1 of 3
  before.
- SQLite connection had no `busy_timeout` set (defaulted to 0 — any momentary
  lock contention failed immediately instead of retrying) — hardened to
  5000ms. Prompted by a live "database disk image is malformed" report;
  `PRAGMA integrity_check` on the real database came back clean, so this was
  very likely a transient connection hiccup, not real corruption. Watch for
  whether it recurs.
- Dead-code sweep (via `knip`, configured with the app's real entry points):
  deleted an orphaned duplicate `reports-view.tsx` (cases-view.tsx already
  has the same report-generation UI built in), a fully-superseded
  `src/shared/types/architect-agent.ts`, and two abandoned planning-stage
  connector stubs (`src/tools/holehe.ts`, `src/tools/ignorant.ts` — same dead
  pattern as `sherlock.ts`, already deleted during the GitHub merge). Also
  declared two real undeclared dependencies (`three-stdlib`, `jszip`) that
  were only working by transitive-dependency luck.
