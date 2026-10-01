# OSINT results graph: event contract for the build chat (Codex)

Prepared by the renderer work on the animated investigation tree. This documents what the tree animation needs from the
orchestrator, what it already derives from today's events, and what is **not** supported yet. It is a proposal: nothing
here changes the orchestrator, IPC, schemas or migrations, and none of these event names exist yet.

## What the renderer does today (no backend change needed)

The renderer receives two event kinds and a final result:

| Today | Used for |
|---|---|
| `search:source-returned` -> `SourceStatus` (`returned` / `failed` / `skipped`, `observationCount`, `error`) | Source node state, failure marker + reason, "returned with no matches" |
| `search:observations` -> `Observation[]` (each carries `id`, `runId`, `source`, `entity`, `type`, `value`, `kind`) | New leaves, new branches, exact-match pings |
| `search:run` result (`SearchRunResult`) | Terminal state, final snapshot |

Animation is derived from **deltas between snapshots keyed by stable ids**, not from event names:

* a fact is "new" the first time its `entity + type + value` key is seen in a run;
* a source "joins" a fact the first time that source id appears in that fact's source set (an **exact match** event);
* a repeat from a source already counted never pings; discovery links (`kind: "discovery"`) never ping as matches;
* a different run key starts a silent baseline, and a view that opens on existing data (saved case, finished run,
  re-render, filter, resize, zoom, select) never replays discovery animation.

Observations whose `runId` differs from the active run are dropped by the Search view. **`SourceStatus` has no
`runId`**, so a late status from a previous run cannot be rejected in the renderer (gap 1 below).

## Gaps (what the tree cannot show truthfully today)

1. **`SourceStatus` has no `runId`.** Add `runId` so a late `search:source-returned` from a cancelled/previous run can be
   rejected exactly like observations are.
2. **No "source started / running" event.** The tree animates a run-level indicator (the seed) while the run is
   running. It deliberately does **not** pulse individual sources, because that would be invented. When the events
   below exist, `OsintResultsView` already accepts an optional `sourceActivity` prop (see below) that drives the
   per-source halo.
3. **No planned/queued source list.** A muted "queued" marker is only drawn when a real list is supplied.
4. **No cancelled terminal state.** The view has `idle | running | complete`; a cancelled run is currently
   indistinguishable from a complete one. Needed: terminal `cancelled` plus the partial counts.
5. **No ordered event id / sequence.** Idempotency today relies on stable observation ids and fact keys. A per-run
   monotonic `sequence` (or unique `eventId`) would let the renderer drop duplicates and detect a gap.
6. **No relationship/candidate assertions.** `candidate` edges exist in the model type and the stylesheet (dashed,
   warning colour, always labelled "Candidate") but nothing generates them.
7. **No expansion limits.** "Not expanded" nodes need the configured round count and hop depth from the backend.

## Proposed lifecycle events

All events carry `runId` and a per-run `sequence`.

```ts
type SourcePlanned   = { type: "search:source-planned";   runId; sequence; sourceId; label };
type SourceStarted   = { type: "search:source-started";   runId; sequence; sourceId };
type SourceProgress  = { type: "search:source-progress";  runId; sequence; sourceId; observationCount: number }; // count only, never a percentage
type SourceFinished  = { type: "search:source-returned";  runId; sequence; status: SourceStatus };            // existing, plus runId/sequence
type ObservationBatch = { type: "search:observations";    runId; sequence; sourceId; observations: Observation[] }; // existing, plus sequence/sourceId
type RunFinished     = { type: "search:run-finished";     runId; sequence; state: "complete" | "cancelled" | "failed"; counts: { observations: number; sources: number } };
```

Ordering rules the renderer relies on: a source may finish before its observations arrive (observations must not be
dropped), and events may repeat (the renderer is idempotent on ids). No percentage-complete is needed or used; progress
is shown as indeterminate unless a reliable total is supplied.

### Entity-graph expansion (future)

Future nodes (person, address, company, parcel, record) and edges must carry **explicit typed assertions with
provenance**, for example `listed officer of`, `owns parcel`, `registered agent for`, `same address reported`:

```ts
type RelationshipAssertion = {
  id: string; runId: string;
  from: { type: string; key: string }; to: { type: string; key: string };
  predicate: string;                  // "registered agent for", "same address reported", ...
  status: "supported" | "candidate";  // supported = solid path; candidate = dashed + "Candidate" label
  provenance: { sourceId: string; observationIds: string[] };
};
```

Not inferred by the renderer, ever: kinship from a shared address, ownership from being a registered agent, identity
from similar names. Discovery links (`kind: "discovery"`) stay labelled "Discovery link · not fetched evidence".
Expansion limits are owned by the backend; the tree never requests deeper searches.

## Renderer hooks that already exist for these events

`OsintResultsView` optional props (all additive; absent = current behaviour):

* `runKey: string | null` - the active run id, used to scope animation bookkeeping and reject stale pings.
* `live?: boolean` - whether arrivals should animate (default: `phase === "running"`). Pass `false` for a saved case.
* `sourceActivity?: ReadonlyMap<string, "queued" | "running">` - per-source halo / muted queued marker, supplied only
  when a real lifecycle event says so.
* `motionPolicy?: "auto" | "reduced"` - the in-app motion setting and `prefers-reduced-motion` both force static
  rendering; evidence keeps updating either way.
