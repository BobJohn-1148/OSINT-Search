/**
 * Arrival bookkeeping decides which animations may play, because a graph that pings on every re-render teaches the
 * investigator to ignore pings. A ping must mean exactly one thing: evidence that was not on screen a moment ago just
 * arrived, or a source that had not yet reported this exact fact just reported it. Everything here is therefore a pure
 * function of "what had already been seen in this run" versus "what is on screen now", keyed by stable fact and source
 * ids, so rendering, filtering, sorting, resizing, selecting or zooming (none of which change those sets) can never
 * replay a discovery.
 *
 * Why derive deltas from the evidence instead of listening for events here: the backend sends snapshots today (a source
 * status, then observation batches), and a renderer-only copy of backend lifecycle truth would drift from it. Deltas
 * computed from stable keys work for snapshots now and keep working when real lifecycle events arrive. Rejected: a
 * timer or animation frame per observation. One bounded visual batch per update keeps a burst of thousands of
 * observations from queueing thousands of animations.
 *
 * Timing values are named tokens (mirrored in osint-results.css as --osr-t-*) so a tuned value is changed in one
 * place and the test that compares the two fails if they drift.
 */
import type { EvidenceFact, SourceRow, SourceState } from "./osint-results-model";

/** Milliseconds. Design targets from the animation handoff; tune after visual inspection, in both files. */
export const MOTION = {
  rootIn: 220,
  sourceCycle: 1800,
  edgeDraw: 320,
  nodeIn: 180,
  stagger: 40,
  staggerMax: 300,
  matchPing: 700,
  select: 120,
  sourceFail: 180,
  settle: 200,
  layout: 220
} as const;

/** At most this many arrivals are animated per batch; the rest appear immediately (the data is never held back). */
export const MAX_ANIMATED_PER_BATCH = 12;

export interface MotionState {
  /** The run this bookkeeping belongs to. A different key means a new run, so nothing carries over. */
  readonly runKey: string | null;
  /** Per fact: connector integrations already seen reporting it (for graph edges). */
  readonly factSources: ReadonlyMap<string, ReadonlySet<string>>;
  /** Per fact: upstream families already seen (only these can newly corroborate). */
  readonly factFamilies: ReadonlyMap<string, ReadonlySet<string>>;
  readonly sourceStates: ReadonlyMap<string, SourceState>;
}

export interface MatchEvent {
  readonly factKey: string;
  /** Sources that had not reported this fact before this update. */
  readonly joinedSources: readonly string[];
  /** Distinct declared upstream families reporting the fact now. */
  readonly totalSources: number;
}

export interface ArrivalDelta {
  readonly newFactKeys: readonly string[];
  /** Edge ids (`observed:<source>:<factKey>`) that did not exist before this update. */
  readonly newEdgeIds: readonly string[];
  readonly newSourceIds: readonly string[];
  readonly matches: readonly MatchEvent[];
  readonly stateChanges: readonly { readonly sourceId: string; readonly from: SourceState | null; readonly to: SourceState }[];
}

export const EMPTY_DELTA: ArrivalDelta = { newFactKeys: [], newEdgeIds: [], newSourceIds: [], matches: [], stateChanges: [] };

export const edgeIdFor = (sourceId: string, factKey: string): string => `observed:${sourceId}:${factKey}`;

export function isEmptyDelta(delta: ArrivalDelta): boolean {
  return delta.newFactKeys.length === 0 && delta.newSourceIds.length === 0 && delta.matches.length === 0 && delta.stateChanges.length === 0 && delta.newEdgeIds.length === 0;
}

function snapshot(runKey: string | null, facts: readonly EvidenceFact[], rows: readonly SourceRow[]): MotionState {
  return {
    runKey,
    factSources: new Map(facts.map((fact) => [fact.key, new Set(fact.sourceIds)])),
    factFamilies: new Map(facts.map((fact) => [fact.key, new Set(fact.upstreamFamilyIds)])),
    sourceStates: new Map(rows.map((row) => [row.sourceId, row.state]))
  };
}

/**
 * Compares the evidence on screen with what this run had already shown.
 *
 *  - A new run key starts from a silent baseline: anything already present is not "arriving".
 *  - When `live` is false (a saved case, a finished run, a restored view) the state is updated silently, so reopening
 *    evidence never pretends to be a live search.
 *  - A fact is "new" the first time its key is seen; a source "joins" a fact the first time that source id appears in
 *    that fact's sources. A repeat from a source already counted changes nothing, so it can never re-ping.
 *  - A match is only reported for evidence facts: discovery links are leads, never corroboration.
 */
export function diffArrivals(
  previous: MotionState | null | undefined,
  runKey: string | null,
  facts: readonly EvidenceFact[],
  rows: readonly SourceRow[],
  live: boolean
): { readonly state: MotionState; readonly delta: ArrivalDelta } {
  if (previous?.runKey !== runKey) {
    return { state: snapshot(runKey, facts, rows), delta: EMPTY_DELTA };
  }
  const next = snapshot(runKey, facts, rows);
  if (!live) {
    return { state: next, delta: EMPTY_DELTA };
  }
  const newFactKeys: string[] = [];
  const newEdgeIds: string[] = [];
  const matches: MatchEvent[] = [];
  for (const fact of facts) {
    const before = previous.factSources.get(fact.key);
    const beforeFamilies = previous.factFamilies.get(fact.key);
    const joined = fact.sourceIds.filter((sourceId) => !before?.has(sourceId));
    const joinedFamilies = fact.upstreamFamilyIds.filter((familyId) => !beforeFamilies?.has(familyId));
    if (!before) {
      newFactKeys.push(fact.key);
    }
    for (const sourceId of joined) {
      newEdgeIds.push(edgeIdFor(sourceId, fact.key));
    }
    if (fact.kind === "evidence" && fact.corroborated && joinedFamilies.length > 0) {
      matches.push({ factKey: fact.key, joinedSources: joined, totalSources: fact.upstreamFamilyIds.length });
    }
  }
  const newSourceIds = rows.filter((row) => !previous.sourceStates.has(row.sourceId)).map((row) => row.sourceId);
  const stateChanges = rows
    .filter((row) => previous.sourceStates.get(row.sourceId) !== row.state)
    .map((row) => ({ sourceId: row.sourceId, from: previous.sourceStates.get(row.sourceId) ?? null, to: row.state }));
  return { state: next, delta: { newFactKeys, newEdgeIds, newSourceIds, matches, stateChanges } };
}

/** The short polite announcement for a batch of counts, e.g. "3 new facts; 1 new exact match". Empty when nothing arrived. */
export function describeCounts(facts: number, matches: number, failedSources: number): string {
  const parts: string[] = [];
  if (facts > 0) {
    parts.push(`${facts} new fact${facts === 1 ? "" : "s"}`);
  }
  if (matches > 0) {
    parts.push(`${matches} new exact match${matches === 1 ? "" : "es"}`);
  }
  if (failedSources > 0) {
    parts.push(`${failedSources} source${failedSources === 1 ? "" : "s"} failed`);
  }
  return parts.join("; ");
}

export function describeArrival(delta: ArrivalDelta): string {
  return describeCounts(delta.newFactKeys.length, delta.matches.length, delta.stateChanges.filter((change) => change.to === "failed").length);
}

/**
 * Visual delays for a batch: a small stagger, capped in total, and only the first few arrivals are animated at all.
 * Items past the cap get `null` (appear immediately); their data is already on screen and selectable.
 */
export function staggerPlan(count: number, maxAnimated: number = MAX_ANIMATED_PER_BATCH): readonly (number | null)[] {
  const delays: (number | null)[] = [];
  for (let index = 0; index < count; index += 1) {
    delays.push(index < maxAnimated ? Math.min(index * MOTION.stagger, MOTION.staggerMax) : null);
  }
  return delays;
}
