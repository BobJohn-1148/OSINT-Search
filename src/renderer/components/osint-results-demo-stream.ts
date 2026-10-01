/**
 * The streaming demo plays a fixed, deterministic run through the same props the real results view receives, so the
 * tree's arrival animation can be reviewed and tested without a search, a provider or any real data. Every entity is a
 * reserved example domain or a TEST-NET address, and the preview labels the whole surface "Demo data".
 *
 * The script is pure data plus a pure `apply`, so a test can replay it to any point and assert exactly what the tree
 * should have seen, and the preview's timer only decides *when* a frame is applied. Pausing visual motion in the
 * preview never pauses these events: ingestion and animation are independent, as they must be in the real view.
 *
 * Source lifecycle ("queued", "running") is simulated here because the backend does not emit it yet; the demo says so
 * in its event log, and the real view only draws that motion when real events supply it (see
 * planning/OSINT-GRAPH-EVENT-CONTRACT.md).
 */
import type { Observation, SourceStatus } from "../../shared/types/search";
import type { SourceLifecycle } from "./osint-results-tree";

export interface DemoState {
  readonly phase: "idle" | "running" | "complete";
  readonly observations: readonly Observation[];
  readonly statuses: readonly SourceStatus[];
  readonly activity: ReadonlyMap<string, SourceLifecycle>;
}

export interface DemoFrame {
  /** Milliseconds after play. */
  readonly at: number;
  /** Plain-language description for the preview's event log. */
  readonly note: string;
  readonly apply: (state: DemoState) => DemoState;
}

export const demoIdle: DemoState = { phase: "idle", observations: [], statuses: [], activity: new Map() };

const RUN_ID = "demo-stream";

function observation(id: string, source: string, type: string, value: string, entity = "example.com"): Observation {
  // each demo source stands for its own upstream family, so a second source on the same fact is a real exact match
  return { id, runId: RUN_ID, entity, type, value, source, upstreamFamilyId: `demo-family:${source}`, confidence: 1, raw: { sourceUrl: `https://${source}.example.test/${id}` } };
}

const LABELS: Readonly<Record<string, string>> = { "dns-a": "DNS A", "dns-b": "DNS B", rdap: "RDAP", site: "Website contacts" };

function withActivity(state: DemoState, entries: readonly [string, "queued" | "running" | null][]): ReadonlyMap<string, SourceLifecycle> {
  const next = new Map(state.activity);
  for (const [sourceId, value] of entries) {
    if (value === null) {
      next.delete(sourceId);
    } else {
      next.set(sourceId, { state: value, label: LABELS[sourceId] ?? sourceId });
    }
  }
  return next;
}

const returned = (sourceId: string, label: string, count: number): SourceStatus => ({ sourceId, label, status: "returned", observationCount: count });

/**
 * The six-step story from the animation handoff, plus a repeat that must not ping:
 * 1 run begins; 2 source A returns an address; 3 source B returns the same address (one match);
 * 4 A repeats it (no new match); 5 source C returns a conflicting value (separate leaf); 6 a source fails; 7 the run ends.
 */
export function storyScript(): readonly DemoFrame[] {
  return [
    {
      at: 0,
      note: "Run begins. Sources are planned (simulated lifecycle).",
      apply: (state) => ({ ...state, phase: "running", activity: withActivity(state, [["dns-a", "queued"], ["dns-b", "queued"], ["rdap", "queued"], ["site", "queued"]]) })
    },
    { at: 900, note: "Source A starts.", apply: (state) => ({ ...state, activity: withActivity(state, [["dns-a", "running"]]) }) },
    {
      at: 1900,
      note: "Source A returns an address and a hostname.",
      apply: (state) => ({
        ...state,
        observations: [...state.observations, observation("a-1", "dns-a", "ip", "192.0.2.42"), observation("a-2", "dns-a", "hostname", "mail.example.com")],
        statuses: [...state.statuses, returned("dns-a", "DNS A", 2)],
        activity: withActivity(state, [["dns-a", null], ["dns-b", "running"]])
      })
    },
    {
      at: 3300,
      note: "Source B returns the same address: one exact match, one shared leaf.",
      apply: (state) => ({
        ...state,
        observations: [...state.observations, observation("b-1", "dns-b", "ip", "192.0.2.42"), observation("b-2", "dns-b", "nameserver", "ns1.example.net")],
        statuses: [...state.statuses, returned("dns-b", "DNS B", 2)],
        activity: withActivity(state, [["dns-b", null], ["rdap", "running"]])
      })
    },
    {
      at: 4500,
      note: "Source A repeats the same address. Same source: no new match, no ping.",
      apply: (state) => ({ ...state, observations: [...state.observations, observation("a-3", "dns-a", "ip", "192.0.2.42")] })
    },
    {
      at: 5500,
      note: "Source C returns a conflicting address and a registrar: separate leaves, no match styling.",
      apply: (state) => ({
        ...state,
        observations: [...state.observations, observation("c-1", "rdap", "ip", "198.51.100.7"), observation("c-2", "rdap", "registrar", "Example Registrar")],
        statuses: [...state.statuses, returned("rdap", "RDAP", 2)],
        activity: withActivity(state, [["rdap", null], ["site", "running"]])
      })
    },
    {
      at: 6700,
      note: "A source fails. Evidence already on screen stays.",
      apply: (state) => ({
        ...state,
        statuses: [...state.statuses, { sourceId: "site", label: "Website contacts", status: "failed", observationCount: 0, error: "Request timed out after 15 seconds" }],
        activity: withActivity(state, [["site", null]])
      })
    },
    { at: 7600, note: "The run ends. Loading motion stops; the tree is static and inspectable.", apply: (state) => ({ ...state, phase: "complete", activity: new Map() }) }
  ];
}

/**
 * A burst for measuring: `total` observations across six sources arriving in `batches` updates, each also re-sending
 * the sources' growing counts. Many facts match across sources so the tree has plenty to ping, which is exactly the
 * case the batching and caps exist for.
 */
export function burstScript(total = 1200, batches = 24, intervalMs = 140): readonly DemoFrame[] {
  const sources = ["dns-a", "dns-b", "rdap", "crtsh", "passive-dns", "whois"];
  const perBatch = Math.ceil(total / batches);
  const frames: DemoFrame[] = [{ at: 0, note: "Burst begins.", apply: (state) => ({ ...state, phase: "running" }) }];
  for (let batch = 0; batch < batches; batch += 1) {
    frames.push({
      at: 300 + batch * intervalMs,
      note: `Batch ${batch + 1} of ${batches}: ${perBatch} observations.`,
      apply: (state) => {
        const added: Observation[] = [];
        for (let index = 0; index < perBatch; index += 1) {
          const n = batch * perBatch + index;
          if (n >= total) {
            break;
          }
          // every other host is reported by two sources, so the burst contains real exact matches as well as singles
          added.push(observation(`burst-${n}`, sources[n % sources.length] ?? "dns-a", "hostname", `host-${Math.floor(n / 2)}.example.com`));
        }
        const all = [...state.observations, ...added];
        const counts = new Map<string, number>();
        for (const item of all) {
          counts.set(item.source, (counts.get(item.source) ?? 0) + 1);
        }
        return { ...state, observations: all, statuses: sources.filter((id) => counts.has(id)).map((id) => returned(id, id, counts.get(id) ?? 0)) };
      }
    });
  }
  frames.push({ at: 300 + batches * intervalMs + 400, note: "Burst ends.", apply: (state) => ({ ...state, phase: "complete", activity: new Map() }) });
  return frames;
}

/** Replays a script up to (and including) a time, with no timers: the state a viewer would see at that moment. */
export function replay(frames: readonly DemoFrame[], upTo: number): DemoState {
  return frames.filter((frame) => frame.at <= upTo).reduce<DemoState>((state, frame) => frame.apply(state), demoIdle);
}

export const demoRunId = RUN_ID;
