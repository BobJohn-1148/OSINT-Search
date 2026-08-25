# Reacher — standing backlog

Read this alongside `CLAUDE.md` at the start of a session. It tracks what's
actually outstanding right now, not the phase history (`REACHER_PLAN.md` is
for that). Update it as items get fixed or new ones surface — don't let it
go stale.

**Active branch: `working`.** `main` is frozen at its 2026-08-24 pushed state
on purpose. Commit and push to `working` until Jack says otherwise.

## Open bugs (reported, real, not yet fixed)

### "Watch `<uuid>` does not exist" error banner on the Dashboard watchlist card
Recurring — an earlier pass this session closed this out as "a one-time
stale-state artifact," but it showed up again unprompted, so that conclusion
was wrong. Needs a real look at `src/renderer/components/dashboard-view.tsx`'s
watchlist section and `src/main/monitoring/monitoring-service.ts` /
`src/db/repositories/monitoring-repository.ts` for wherever a stale
`watchId` can outlive the row it points at (e.g. renderer state holding an id
from a deleted/recreated watch, or a race between delete and a pending
check-now call).

### Floating "+ Add watch" button in the Watchlist panel header
Distinct from the already-shipped fix (commit `68648cf`, confirmed present in
`working`'s history) that fixed the *in-form* Add-watch button's position.
This is a different problem: the "+ Add watch" control in the panel's
top-right header wraps awkwardly onto two lines ("Add" / "watch") instead of
staying on one line. CSS layout issue in the Watchlist card header, likely in
`src/renderer/components/dashboard-view.tsx` + `src/renderer/styles.css`.

### Citation-integrity rejection on IP-seed agent runs
Real error seen live: `OSINT agent's model response did not cite anything
present in the context it was given ... after one retry`, on an IP seed
(1.1.1.1) run through `llama3.1:8b`. The citation-integrity gate did its job
correctly (rejecting an ungrounded response is the intended behavior), but it
isn't yet established whether this is inherent small-model inconsistency
(acceptable, no code change) or a real formatting bug specific to how
IP-type observations get turned into citation keys in
`src/main/agents/agent-runtime-service.ts` (`buildUserPrompt`). A same-seed
domain-type run (cloudflare.com) succeeded end-to-end in the same session, so
this may be seed-type-specific. Needs a live repro (re-run the same IP seed
a few times, inspect what the model actually returned) before deciding
whether it's a code fix or just expected model variance.

### "database disk image is malformed" (live app, one occurrence)
Investigated: `PRAGMA integrity_check` against the live
`%APPDATA%\reacher\reacher.sqlite` came back clean (`ok`), only one Electron
process was running (no second instance fighting over the file), and the
folder isn't OneDrive-synced. Most likely a transient WAL/connection hiccup,
not real corruption. Jack was asked to fully quit and relaunch the app and
retry the action that triggered it (Save watch). **If it recurs after a
clean restart, this needs real investigation** into the app's SQLite
connection setup (`src/db/database.ts`) — busy_timeout, WAL checkpoint
behavior, whether anything else briefly opens a second connection to the
same file.

## Needs a product decision, not a fix

### "Remove the observations, show the actual data" — scope unclear
Built `scripts/verify-search-live.mjs` (a standing dev script, already
committed) that prints full raw data from a live search run outside the app.
Not touched: the app's own Search page still shows an "X observations: Y
sources returned / Z failed" summary line
(`src/renderer/components/search-view.tsx` ~line 452, and a similar line
~676). If Jack meant the in-app wording too, say so specifically and it's a
quick copy/layout change.

### xAI Grok via puter.com — recommended against
`https://developer.puter.com/tutorials/free-unlimited-grok-api/` routes
requests through Puter's own servers (not local-first), is a browser-side
library (`puter.js`, wrong runtime for the main-process `ChatProvider`
architecture), needs a Puter.com account per user, and discloses no rate
limits or data-retention terms. The right way to add real xAI Grok support is
xAI's own API directly — same pattern as `AnthropicChatProvider` in
`src/main/providers/chat-providers.ts` (API key in the vault, direct HTTPS
call, no proxy). Not built yet; needs a go-ahead.

## Not started

### Dead code / unnecessary lines sweep
Jack asked for a pass over the codebase to find and delete dead weight —
unused exports, functions nothing calls, leftover scaffolding. Not yet done.
Worth running `npx knip` or an equivalent unused-export finder rather than
eyeballing, then verifying each deletion doesn't break `npm run verify`
before removing it.

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
