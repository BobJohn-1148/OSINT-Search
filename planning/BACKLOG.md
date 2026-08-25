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

### xAI Grok via puter.com — recommended against, real alternative offered
`https://developer.puter.com/tutorials/free-unlimited-grok-api/` routes
requests through Puter's own servers (not local-first), is a browser-side
library (`puter.js`, wrong runtime for the main-process `ChatProvider`
architecture), needs a Puter.com account per user, and discloses no rate
limits or data-retention terms. The right way to add real xAI Grok support is
xAI's own API directly — same pattern as `AnthropicChatProvider` in
`src/main/providers/chat-providers.ts` (API key in the vault, direct HTTPS
call, no proxy). Not built yet; needs a go-ahead.

## Discovered, not yet actioned

### The Architect agent still runs on template/string-interpolation responses
Found while dead-code-sweeping `architect-chat-provider.ts`:
`CodexArchitectProvider.ask()`/`.proposePlan()` build their output by string
interpolation, not a real model call — the same bug the OSINT runtime agents
(`AgentRuntimeService`, `ChatProviderResolver`) were rewritten to fix earlier
this session, except the Architect agent (used for code-planning tasks, a
separate feature from OSINT investigation) never got the equivalent
treatment. Not fixed here — this is a real feature gap, not a quick patch,
same category as the four items that opened this session's fixing pass.

## Recently completed (context for what NOT to redo)

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
