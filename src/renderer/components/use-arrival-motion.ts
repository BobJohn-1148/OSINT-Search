/**
 * The arrival-motion hook turns evidence arriving in a run into a small, bounded set of "recent" markers the tree can
 * animate, and into one short sentence for screen readers and for people who see no motion at all.
 *
 * Why the markers are derived while rendering, not set from an effect: a node that has just arrived must be drawn
 * already in its "arriving" state. An effect would let the browser paint the finished node for one frame before the
 * marker is applied (a visible flash). React re-renders immediately when state is adjusted during render from a change
 * in inputs, so the first paint already carries the marker. The computation is pure (previous tracked state + inputs),
 * so a development double-render or a repeated snapshot is idempotent: the same evidence yields the same result.
 *
 * Why one timer per batch (never one per observation): a source can return thousands of observations. Each batch
 * animates at most MAX_ANIMATED_PER_BATCH items, the markers expire together on a single timer that the next batch
 * re-arms, and the marker sets are capped, so a burst cannot queue unbounded work. Every timer is cleared on unmount
 * and when a new run starts, and nothing keeps running after the run completes.
 *
 * Motion off (the in-app switch, prefers-reduced-motion, or a forced reduced policy) never stops evidence updating or
 * announcements: only the markers are skipped.
 */
import { useEffect, useState } from "react";
import {
  MAX_ANIMATED_PER_BATCH,
  MOTION,
  describeCounts,
  diffArrivals,
  edgeIdFor,
  isEmptyDelta,
  staggerPlan,
  type ArrivalDelta,
  type MotionState
} from "./osint-results-motion";
import type { EvidenceFact, SourceRow } from "./osint-results-model";

export interface Marker {
  /** Changes for every batch that touches the item, so a one-shot overlay (a ping) is re-created and plays again. */
  readonly token: number;
  readonly delay: number;
}

export interface RecentArrivals {
  readonly nodes: ReadonlyMap<string, Marker>;
  readonly edges: ReadonlyMap<string, Marker>;
  /** Fact node id -> ring ping. */
  readonly pings: ReadonlyMap<string, Marker>;
  /** Edge id -> lit path ping. */
  readonly edgePings: ReadonlyMap<string, Marker>;
  readonly failed: ReadonlySet<string>;
}

const NONE: RecentArrivals = { nodes: new Map(), edges: new Map(), pings: new Map(), edgePings: new Map(), failed: new Set() };
/** Hard cap per marker kind, whatever the arrival rate: the tree draws at most 24 facts, so more markers could never be seen. */
const MAX_MARKERS = 24;
const ANNOUNCE_QUIET_MS = 700;
const EXPIRY_MS = MOTION.staggerMax + MOTION.edgeDraw + MOTION.nodeIn + MOTION.matchPing + 150;

export type MotionPolicy = "auto" | "reduced";

export interface ArrivalMotion {
  readonly motionOn: boolean;
  readonly userMotion: boolean;
  readonly setUserMotion: (on: boolean) => void;
  readonly reduced: boolean;
  readonly recent: RecentArrivals;
  /** Visible text for the most recent batch (kept until the next one). */
  readonly latestText: string;
  /** Polite live-region text; changes once per quiet period, never per observation. */
  readonly announcement: string;
  readonly pageHidden: boolean;
}

interface Pending {
  readonly facts: number;
  readonly matches: number;
  readonly failed: number;
  readonly cancelled: number;
}

interface Tracked {
  readonly facts: readonly EvidenceFact[];
  readonly rows: readonly SourceRow[];
  readonly runKey: string | null;
  readonly live: boolean;
  readonly motionOn: boolean;
  readonly state: MotionState | null;
  readonly recent: RecentArrivals;
  readonly token: number;
  /** Increments whenever timers must be re-armed (a batch arrived or the run changed). */
  readonly batch: number;
  readonly pending: Pending;
  readonly latestText: string;
  readonly announcement: string;
}

function capped<T>(map: Map<string, T>): Map<string, T> {
  while (map.size > MAX_MARKERS) {
    const oldest = map.keys().next();
    if (oldest.done) {
      break;
    }
    map.delete(oldest.value);
  }
  return map;
}

function mergeRecent(previous: RecentArrivals, delta: ArrivalDelta, token: number): RecentArrivals {
  const nodes = new Map(previous.nodes);
  const edges = new Map(previous.edges);
  const pings = new Map(previous.pings);
  const edgePings = new Map(previous.edgePings);
  const failed = new Set(previous.failed);
  const plan = staggerPlan(delta.newFactKeys.length, MAX_ANIMATED_PER_BATCH);
  const delayOf = new Map<string, number>();
  delta.newFactKeys.forEach((key, index) => {
    const delay = plan[index];
    if (delay !== null) {
      delayOf.set(key, delay);
      nodes.set(`fact:${key}`, { token, delay });
    }
  });
  for (const sourceId of delta.newSourceIds) {
    nodes.set(`source:${sourceId}`, { token, delay: 0 });
    edges.set(`queried:${sourceId}`, { token, delay: 0 });
  }
  for (const edgeId of delta.newEdgeIds) {
    const key = edgeId.split(":").slice(2).join(":");
    const delay = delayOf.get(key);
    if (delay !== undefined) {
      edges.set(edgeId, { token, delay });
    }
  }
  for (const match of delta.matches) {
    // a ping waits for its leaf and branch to finish drawing when they are part of the same batch
    const own = delayOf.get(match.factKey);
    const base = own === undefined ? 0 : own + MOTION.edgeDraw + MOTION.nodeIn;
    pings.set(`fact:${match.factKey}`, { token, delay: base });
    for (const sourceId of match.joinedSources) {
      edgePings.set(edgeIdFor(sourceId, match.factKey), { token, delay: base });
    }
  }
  for (const change of delta.stateChanges) {
    if (change.to === "failed" && change.cancelled !== true) {
      failed.add(change.sourceId);
    }
  }
  return { nodes: capped(nodes), edges: capped(edges), pings: capped(pings), edgePings: capped(edgePings), failed };
}

/** Pure: the next tracked state for new inputs. Same inputs and previous state always give the same result. */
function advance(previous: Tracked, facts: readonly EvidenceFact[], rows: readonly SourceRow[], runKey: string | null, live: boolean, motionOn: boolean): Tracked {
  const { state, delta } = diffArrivals(previous.state, runKey, facts, rows, live);
  const newRun = previous.state?.runKey !== runKey;
  const base = { facts, rows, runKey, live, motionOn, state };
  if (newRun) {
    // a new run: nothing from the previous run may still be pinging or waiting to be announced
    return { ...base, recent: NONE, token: previous.token, batch: previous.batch + 1, pending: { facts: 0, matches: 0, failed: 0, cancelled: 0 }, latestText: "", announcement: "" };
  }
  if (isEmptyDelta(delta)) {
    return { ...previous, ...base, recent: motionOn ? previous.recent : NONE };
  }
  const token = previous.token + 1;
  const failed = delta.stateChanges.filter((change) => change.to === "failed" && change.cancelled !== true).length;
  const cancelled = delta.stateChanges.filter((change) => change.cancelled === true).length;
  return {
    ...base,
    recent: motionOn ? mergeRecent(previous.recent, delta, token) : NONE,
    token,
    batch: previous.batch + 1,
    pending: { facts: previous.pending.facts + delta.newFactKeys.length, matches: previous.pending.matches + delta.matches.length, failed: previous.pending.failed + failed, cancelled: previous.pending.cancelled + cancelled },
    latestText: previous.latestText,
    announcement: previous.announcement
  };
}

function useReducedMotion(policy: MotionPolicy): boolean {
  const [system, setSystem] = useState(() => (typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false));
  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return undefined;
    }
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (): void => setSystem(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return policy === "reduced" || system;
}

function usePageHidden(): boolean {
  const [hidden, setHidden] = useState(() => document.visibilityState === "hidden");
  useEffect(() => {
    const onChange = (): void => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return hidden;
}

export function useArrivalMotion(args: {
  readonly runKey: string | null;
  readonly facts: readonly EvidenceFact[];
  readonly rows: readonly SourceRow[];
  readonly live: boolean;
  readonly policy?: MotionPolicy;
}): ArrivalMotion {
  const { runKey, facts, rows, live, policy = "auto" } = args;
  const reduced = useReducedMotion(policy);
  const pageHidden = usePageHidden();
  const [userMotion, setUserMotion] = useState(true);
  const motionOn = userMotion && !reduced;
  const [tracked, setTracked] = useState<Tracked>(() => ({
    facts,
    rows,
    runKey,
    live,
    motionOn,
    state: diffArrivals(null, runKey, facts, rows, live).state,
    recent: NONE,
    token: 0,
    batch: 0,
    pending: { facts: 0, matches: 0, failed: 0, cancelled: 0 },
    latestText: "",
    announcement: ""
  }));

  // Adjusting state while rendering (not in an effect) so an arriving node is painted already in its arriving state.
  let current = tracked;
  if (tracked.facts !== facts || tracked.rows !== rows || tracked.runKey !== runKey || tracked.live !== live || tracked.motionOn !== motionOn) {
    current = advance(tracked, facts, rows, runKey, live, motionOn);
    setTracked(current);
  }

  const { batch } = current;
  useEffect(() => {
    if (batch === 0) {
      return undefined;
    }
    // one expiry timer and one announcement timer per batch; both are cleared when the next batch arrives or on unmount
    const expiry = window.setTimeout(() => setTracked((previous) => (previous.batch === batch ? { ...previous, recent: NONE } : previous)), EXPIRY_MS);
    const announce = window.setTimeout(() => {
      setTracked((previous) => {
        if (previous.batch !== batch) {
          return previous;
        }
        const text = describeCounts(previous.pending.facts, previous.pending.matches, previous.pending.failed, previous.pending.cancelled);
        const cleared = { facts: 0, matches: 0, failed: 0, cancelled: 0 };
        return text ? { ...previous, pending: cleared, announcement: text, latestText: text } : { ...previous, pending: cleared };
      });
    }, ANNOUNCE_QUIET_MS);
    return () => {
      window.clearTimeout(expiry);
      window.clearTimeout(announce);
    };
  }, [batch]);

  return { motionOn, userMotion, setUserMotion, reduced, recent: current.recent, latestText: current.latestText, announcement: current.announcement, pageHidden };
}
