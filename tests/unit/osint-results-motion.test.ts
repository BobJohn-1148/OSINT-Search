/**
 * Arrival bookkeeping decides when an animation is allowed to play. These tests pin the rules from the graph-animation
 * handoff: a new fact draws once, a second distinct source on the same exact fact pings once, a repeat from a source
 * already counted never pings, a conflicting value stays separate, and nothing replays on re-render, on a saved case,
 * or across runs. If one of these drifted, pings would stop meaning "new evidence arrived".
 */
import fs from "node:fs";
import path from "node:path";
import {
  EMPTY_DELTA,
  MAX_ANIMATED_PER_BATCH,
  MOTION,
  describeArrival,
  diffArrivals,
  edgeIdFor,
  isEmptyDelta,
  staggerPlan,
  type ArrivalDelta,
  type MotionState
} from "../../src/renderer/components/osint-results-motion";
import { buildFacts, buildSourceRows } from "../../src/renderer/components/osint-results-model";
import type { Observation, SourceStatus } from "../../src/shared/types/search";

function obs(id: string, source: string, value: string, extra: Partial<Observation> = {}): Observation {
  return { id, runId: "run-1", entity: "example.com", type: "ip", value, source, confidence: 1, upstreamFamilyId: `family:${source}`, ...extra };
}

function view(observations: readonly Observation[], statuses: readonly SourceStatus[] = []) {
  const facts = buildFacts(observations);
  const rows = buildSourceRows(statuses, observations);
  return { facts, rows };
}

const returned = (sourceId: string, count = 1): SourceStatus => ({ sourceId, label: sourceId, status: "returned", observationCount: count });

/** Runs a sequence of snapshots through the bookkeeping the way the view does, returning every delta. */
function play(snapshots: readonly { observations: readonly Observation[]; statuses?: readonly SourceStatus[] }[], runKey = "run-1", live = true) {
  let state: MotionState | null = null;
  // elements are read back by index in the tests below, so they are typed as possibly missing
  const deltas: (ArrivalDelta | undefined)[] = [];
  for (const snap of snapshots) {
    const { facts, rows } = view(snap.observations, snap.statuses);
    const result = diffArrivals(state, runKey, facts, rows, live);
    state = result.state;
    deltas.push(result.delta);
  }
  return deltas;
}

describe("first arrival", () => {
  it("draws a branch and a leaf for the first source's fact: one new fact, one new edge, no match", () => {
    const [baseline, first] = play([{ observations: [] }, { observations: [obs("a", "dns-a", "192.0.2.42")], statuses: [returned("dns-a")] }]);
    expect(isEmptyDelta(baseline ?? EMPTY_DELTA)).toBe(true);
    expect(first?.newFactKeys).toHaveLength(1);
    expect(first?.newSourceIds).toEqual(["dns-a"]);
    expect(first?.newEdgeIds).toHaveLength(1);
    expect(first?.matches).toHaveLength(0);
  });

  it("is silent for anything already on screen when the run is first seen (a view that opens mid-run)", () => {
    const [first] = play([{ observations: [obs("a", "dns-a", "192.0.2.42")], statuses: [returned("dns-a")] }]);
    expect(isEmptyDelta(first ?? EMPTY_DELTA)).toBe(true);
  });
});

describe("exact matches", () => {
  const a = obs("a", "dns-a", "192.0.2.42");
  const b = obs("b", "dns-b", "192.0.2.42");

  it("pings once when a second distinct source reports the same normalised entity, type and value, onto the existing leaf", () => {
    const [, , second] = play([{ observations: [] }, { observations: [a], statuses: [returned("dns-a")] }, { observations: [a, b], statuses: [returned("dns-a"), returned("dns-b")] }]);
    expect(second?.newFactKeys).toHaveLength(0);
    expect(second?.matches).toHaveLength(1);
    expect(second?.matches[0]?.joinedSources).toEqual(["dns-b"]);
    expect(second?.matches[0]?.totalSources).toBe(2);
    expect(second?.newEdgeIds).toEqual([edgeIdFor("dns-b", second?.matches[0]?.factKey ?? "")]);
  });

  it("matches across case and spacing, because correlation uses the same normalisation as the main process", () => {
    const loud = obs("c", "dns-b", " 192.0.2.42 ", { entity: "EXAMPLE.com" });
    const [, , second] = play([{ observations: [] }, { observations: [a] }, { observations: [a, loud] }]);
    expect(second?.matches).toHaveLength(1);
  });

  it("does not ping again for repeated observations from a source already counted", () => {
    const repeat = obs("a2", "dns-a", "192.0.2.42");
    const deltas = play([{ observations: [] }, { observations: [a, b] }, { observations: [a, b, repeat] }, { observations: [a, b, repeat, obs("a3", "dns-b", "192.0.2.42")] }]);
    expect(deltas[1]?.matches).toHaveLength(1);
    expect(isEmptyDelta(deltas[2] ?? EMPTY_DELTA)).toBe(true);
    expect(isEmptyDelta(deltas[3] ?? EMPTY_DELTA)).toBe(true);
  });

  it("reports a match when two sources first appear together in one batch", () => {
    const [, batch] = play([{ observations: [] }, { observations: [a, b] }]);
    expect(batch?.newFactKeys).toHaveLength(1);
    expect(batch?.matches).toHaveLength(1);
    expect(batch?.matches[0]?.joinedSources).toEqual(["dns-a", "dns-b"]);
  });

  it("reports another match, with the new total, when a third independent upstream family joins an exact match", () => {
    const c = obs("c", "dns-c", "192.0.2.42");
    const [, , , third] = play([{ observations: [] }, { observations: [a] }, { observations: [a, b] }, { observations: [a, b, c] }]);
    expect(third?.matches).toHaveLength(1);
    expect(third?.matches[0]?.totalSources).toBe(3);
    expect(third?.matches[0]?.joinedSources).toEqual(["dns-c"]);
    expect(third?.newFactKeys).toHaveLength(0);
  });

  it("keeps a conflicting value as its own new fact with no match", () => {
    const conflict = obs("c", "dns-c", "198.51.100.7");
    const [, , third] = play([{ observations: [] }, { observations: [a, b] }, { observations: [a, b, conflict] }]);
    expect(third?.newFactKeys).toHaveLength(1);
    expect(third?.matches).toHaveLength(0);
  });

  it("never reports a match for discovery links, which are leads and not corroboration", () => {
    const lead = (id: string, source: string): Observation => obs(id, source, "https://example.test/profile", { kind: "discovery", type: "profile-url" });
    const [, second] = play([{ observations: [lead("l1", "dns-a")] }, { observations: [lead("l1", "dns-a"), lead("l2", "dns-b")] }]);
    expect(second?.matches).toHaveLength(0);
  });

  it("does not animate a match when a second integration repeats one known upstream family", () => {
    const first = obs("a", "mirror-a", "192.0.2.42", { upstreamFamilyId: "same-registry" });
    const mirror = obs("b", "mirror-b", "192.0.2.42", { upstreamFamilyId: "same-registry" });
    const [, batch] = play([{ observations: [] }, { observations: [first, mirror] }]);
    expect(batch?.matches).toHaveLength(0);
  });
});

describe("source states", () => {
  it("reports a failed source as a state change and keeps earlier evidence out of the delta", () => {
    const a = obs("a", "dns-a", "192.0.2.42");
    const failed: SourceStatus = { sourceId: "site", label: "Website contacts", status: "failed", observationCount: 0, error: "Request timed out" };
    const [, , third] = play([{ observations: [] }, { observations: [a], statuses: [returned("dns-a")] }, { observations: [a], statuses: [returned("dns-a"), failed] }]);
    expect(third?.stateChanges).toEqual([{ sourceId: "site", from: null, to: "failed" }]);
    expect(third?.newFactKeys).toHaveLength(0);
  });

  it("sees a source move from reporting to returned without treating it as new evidence", () => {
    const a = obs("a", "dns-a", "192.0.2.42");
    const [, , done] = play([{ observations: [] }, { observations: [a] }, { observations: [a], statuses: [returned("dns-a")] }]);
    expect(done?.stateChanges).toEqual([{ sourceId: "dns-a", from: "observed", to: "returned" }]);
    expect(done?.newFactKeys).toHaveLength(0);
  });

  it("keeps observations that arrive after their source's status (a source finishing first never drops them)", () => {
    const a = obs("a", "dns-a", "192.0.2.42");
    const [, early, late] = play([{ observations: [] }, { observations: [], statuses: [returned("dns-a", 1)] }, { observations: [a], statuses: [returned("dns-a", 1)] }]);
    expect(early?.newSourceIds).toEqual(["dns-a"]);
    expect(late?.newFactKeys).toHaveLength(1);
  });
});

describe("nothing replays", () => {
  const a = obs("a", "dns-a", "192.0.2.42");
  const b = obs("b", "dns-b", "192.0.2.42");

  it("produces an empty delta when the same evidence is seen again (re-render, filter, sort, resize, select, zoom)", () => {
    const deltas = play([{ observations: [] }, { observations: [a, b] }, { observations: [a, b] }, { observations: [b, a] }, { observations: [a, b] }]);
    expect(isEmptyDelta(deltas[2] ?? EMPTY_DELTA)).toBe(true);
    expect(isEmptyDelta(deltas[3] ?? EMPTY_DELTA)).toBe(true);
    expect(isEmptyDelta(deltas[4] ?? EMPTY_DELTA)).toBe(true);
  });

  it("is silent when not live, so reopening a saved case or a finished run never pretends to be a live search", () => {
    const deltas = play([{ observations: [] }, { observations: [a] }, { observations: [a, b] }], "case-9", false);
    expect(deltas.every((delta) => isEmptyDelta(delta ?? EMPTY_DELTA))).toBe(true);
  });

  it("starts a new run from a silent baseline and cannot receive the previous run's pings", () => {
    let state: MotionState | null = null;
    const first = view([a]);
    state = diffArrivals(state, "run-1", first.facts, first.rows, true).state;
    const second = view([a, b]);
    const afterOld = diffArrivals(state, "run-1", second.facts, second.rows, true);
    expect(afterOld.delta.matches).toHaveLength(1);
    // the same evidence under a different run key: baseline only, nothing arrives
    const fresh = diffArrivals(afterOld.state, "run-2", second.facts, second.rows, true);
    expect(isEmptyDelta(fresh.delta)).toBe(true);
    expect(fresh.state.runKey).toBe("run-2");
  });
});

describe("batching and announcements", () => {
  it("summarises a batch in one short polite line", () => {
    const delta = { ...EMPTY_DELTA, newFactKeys: ["a", "b", "c"], matches: [{ factKey: "a", joinedSources: ["x"], totalSources: 2 }] };
    expect(describeArrival(delta)).toBe("3 new facts; 1 new exact match");
    expect(describeArrival({ ...EMPTY_DELTA, newFactKeys: ["a"] })).toBe("1 new fact");
    expect(describeArrival(EMPTY_DELTA)).toBe("");
    expect(describeArrival({ ...EMPTY_DELTA, stateChanges: [{ sourceId: "s", from: "observed", to: "failed" }] })).toBe("1 source failed");
  });

  it("announces a cancelled source as cancelled, never as failed", () => {
    const delta = { ...EMPTY_DELTA, stateChanges: [{ sourceId: "s", from: "observed" as const, to: "failed" as const, cancelled: true as const }] };
    expect(describeArrival(delta)).toBe("1 source cancelled");
  });

  it("staggers a small visible set by 40 ms up to 300 ms total and leaves the rest unanimated", () => {
    const plan = staggerPlan(1000);
    expect(plan.slice(0, 3)).toEqual([0, 40, 80]);
    expect(plan.filter((delay) => delay !== null)).toHaveLength(MAX_ANIMATED_PER_BATCH);
    expect(Math.max(...plan.filter((delay): delay is number => delay !== null))).toBeLessThanOrEqual(MOTION.staggerMax);
    expect(plan[MAX_ANIMATED_PER_BATCH]).toBeNull();
    expect(plan.at(-1)).toBeNull();
  });

  it("copes with a burst of 5000 observations quickly and animates a bounded number", () => {
    const burst = Array.from({ length: 5000 }, (_, index) => obs(`b${index}`, `src-${index % 6}`, `10.0.${Math.floor(index / 250)}.${index % 250}`));
    let state: MotionState | null = null;
    const empty = view([]);
    state = diffArrivals(state, "run-1", empty.facts, empty.rows, true).state;
    const full = view(burst);
    const start = performance.now();
    const { delta } = diffArrivals(state, "run-1", full.facts, full.rows, true);
    expect(performance.now() - start).toBeLessThan(500);
    expect(delta.newFactKeys.length).toBe(5000);
    expect(staggerPlan(delta.newFactKeys.length).filter((delay) => delay !== null)).toHaveLength(MAX_ANIMATED_PER_BATCH);
  });
});

describe("motion tokens", () => {
  it("are mirrored in the stylesheet, so a tuned value cannot drift between script and CSS", () => {
    const css = fs.readFileSync(path.resolve(import.meta.dirname, "../../src/renderer/osint-results-tree.css"), "utf8");
    const tokens: Record<string, number> = {
      "--osr-t-root-in": MOTION.rootIn,
      "--osr-t-source-cycle": MOTION.sourceCycle,
      "--osr-t-edge-draw": MOTION.edgeDraw,
      "--osr-t-node-in": MOTION.nodeIn,
      "--osr-t-match-ping": MOTION.matchPing,
      "--osr-t-select": MOTION.select,
      "--osr-t-source-fail": MOTION.sourceFail,
      "--osr-t-settle": MOTION.settle,
      "--osr-t-layout": MOTION.layout
    };
    for (const [name, value] of Object.entries(tokens)) {
      expect(css, name).toMatch(new RegExp(`${name}:\\s*${value}ms`));
    }
  });
});
