/**
 * The investigation tree lays the run out as seed -> source -> fact so the investigator can read where each fact came
 * from. Layout is a pure function of the evidence and the container width, because the animation layer must be able to
 * tell "something new arrived" from "something was re-laid-out", and because stable, deterministic positions are what
 * let settled branches stay anchored while a run grows.
 *
 * Why a tree and not the earlier radial map: a radial ring puts every source and fact on the same circle, so
 * proximity reads as association and new arrivals reshuffle the ring. A tree has one place for each thing, a primary
 * path for each fact (the source that first returned it), and cross-links for every other source that returned the
 * same exact fact. Rows are assigned in arrival order within a source's lane, so adding evidence appends rows instead
 * of moving the ones already on screen. Rejected: a force-directed layout (continuous movement, and positions that
 * differ run to run).
 *
 * Two shapes from one model. "wide" grows left to right: seed, then a column of sources, then a column of facts with
 * the label to the right. "stack" is the vertical tree for phone widths: one row per node, indented by depth, with
 * collapsible source branches, so nothing needs horizontal panning.
 *
 * No edge is invented. A line exists only because a source returned an observation (seed -> source: the source was
 * queried; source -> fact: it returned that fact). `candidate` edges are part of the type so supported and candidate
 * associations can be drawn differently once the backend supplies typed relationship assertions; nothing here
 * generates one.
 */
import type { SearchSeed } from "../../shared/types/search";
import { factKey, shorten, type EvidenceFact, type SourceRow, type SourceState } from "./osint-results-model";

export type TreeMode = "wide" | "stack";
export type TreeEdgeRole = "trunk" | "branch" | "cross" | "candidate";

export interface TreeNode {
  readonly id: string;
  readonly kind: "seed" | "source" | "fact" | "more";
  readonly label: string;
  /** Second line under the label (a source's state, a fact's match badge or provenance). */
  readonly sub?: string;
  readonly fullLabel: string;
  readonly x: number;
  readonly y: number;
  readonly state?: SourceState;
  readonly sourceId?: string;
  readonly factKey?: string;
  readonly factKind?: "evidence" | "discovery";
  readonly corroborated?: boolean;
  readonly sourceCount?: number;
  /** For a source branch: how many of its facts are drawn / hidden by collapsing. */
  readonly drawnFacts?: number;
  readonly collapsed?: boolean;
  readonly hiddenFacts?: number;
  /** The run was stopped before this source finished: drawn muted, never with the failure marker. */
  readonly cancelled?: boolean;
}

export interface TreeEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly role: TreeEdgeRole;
  readonly d: string;
  readonly sourceId?: string;
  readonly factKey?: string;
  /** The edge touches the selected fact. */
  readonly active: boolean;
  readonly corroborated: boolean;
}

export interface TreeModel {
  readonly mode: TreeMode;
  readonly width: number;
  readonly height: number;
  readonly rowHeight: number;
  readonly nodes: readonly TreeNode[];
  readonly edges: readonly TreeEdge[];
  /** Facts drawn, facts hidden because the drawing is full, and facts hidden by collapsed branches. */
  readonly shownFacts: number;
  readonly omittedFacts: number;
  readonly collapsedFacts: number;
  readonly labelChars: number;
}

export const TREE_FACT_LIMIT = 24;
/**
 * Width of the drawing from which the branching canvas is used. The handoff wants the canvas at 1024 px viewports and
 * above, where the tree's own box is only ~560 px wide (the page has a sidebar and a second column), so the breakpoint
 * is on the tree's room, not the window.
 */
export const WIDE_FROM = 520;

/** A source's real lifecycle, supplied only when the backend reports it. Without it the tree draws no per-source motion. */
export interface SourceLifecycle {
  readonly state: "queued" | "running";
  readonly label: string;
}

export interface TreeInput {
  readonly seed: SearchSeed;
  readonly rows: readonly SourceRow[];
  readonly facts: readonly EvidenceFact[];
  readonly selectedKey: string | null;
  readonly width: number;
  readonly collapsed?: ReadonlySet<string>;
  /** Planned or running sources from real lifecycle events; a source not yet in `rows` gets a branch with its state. */
  readonly activity?: ReadonlyMap<string, SourceLifecycle>;
  readonly limit?: number;
  /** Fact key -> position of its first observation in arrival order. Missing keys sort after known ones. */
  readonly arrival?: ReadonlyMap<string, number>;
}

/** Position of each fact's first observation, so rows keep arrival order however the facts are sorted for the list. */
export function arrivalIndex(observations: readonly { readonly entity: string; readonly type: string; readonly value: string }[]): Map<string, number> {
  const order = new Map<string, number>();
  observations.forEach((observation, index) => {
    const key = factKey(observation);
    if (!order.has(key)) {
      order.set(key, index);
    }
  });
  return order;
}

export function treeModeFor(width: number): TreeMode {
  return width >= WIDE_FROM ? "wide" : "stack";
}

const round = (value: number): number => Math.round(value * 10) / 10;

/** A smooth horizontal branch, used by the wide tree. */
function curve(x1: number, y1: number, x2: number, y2: number): string {
  const mid = (x1 + x2) / 2;
  return `M${round(x1)} ${round(y1)}C${round(mid)} ${round(y1)} ${round(mid)} ${round(y2)} ${round(x2)} ${round(y2)}`;
}

/** An elbow down then across, used by the stack tree's primary paths. */
function elbow(x1: number, y1: number, x2: number, y2: number): string {
  return `M${round(x1)} ${round(y1)}V${round(y2)}H${round(x2)}`;
}

/** A cross-link in the stack tree: a gentle S that leaves the source and enters the fact from the left. */
function sweep(x1: number, y1: number, x2: number, y2: number): string {
  return `M${round(x1)} ${round(y1)}C${round(x1 + 26)} ${round(y1)} ${round(x2 - 26)} ${round(y2)} ${round(x2)} ${round(y2)}`;
}

export function treeLayout(input: TreeInput): TreeModel {
  const { seed, facts, selectedKey } = input;
  const activity = input.activity ?? new Map<string, SourceLifecycle>();
  // A source that is planned or running but has not reported yet has no row; give it a branch so the investigator can see
  // what is still loading. It carries no count and no facts, and its state words come from the real lifecycle event.
  const known = new Set(input.rows.map((row) => row.sourceId));
  const planned: SourceRow[] = [...activity]
    .filter(([sourceId]) => !known.has(sourceId))
    .map(([sourceId, lifecycle]) => ({
      sourceId,
      label: lifecycle.label,
      state: "observed" as const,
      stateLabel: lifecycle.state === "running" ? "Running" : "Queued",
      count: null,
      summary: lifecycle.state === "running" ? "Waiting for this source" : "Queued",
      detail: ""
    }));
  const rows: readonly SourceRow[] = [...input.rows, ...planned];
  const limit = input.limit ?? TREE_FACT_LIMIT;
  const collapsed = input.collapsed ?? new Set<string>();
  const mode = treeModeFor(input.width);
  const width = Math.round(Math.min(1200, Math.max(280, input.width)));
  const wide = mode === "wide";
  const rowHeight = wide ? 56 : 48;
  const pad = 22;

  const lane = new Map(rows.map((row, index) => [row.sourceId, index]));
  const arrival = input.arrival ?? new Map<string, number>();
  const arrivalOf = (fact: EvidenceFact): number => arrival.get(fact.key) ?? Number.MAX_SAFE_INTEGER;

  // Which facts fit. Selected first, then exact matches, then arrival order; the list always holds every fact.
  const drawable = facts.filter((fact) => fact.sourceIds.some((id) => lane.has(id)));
  const ranked = [...drawable].sort(
    (a, b) => Number(b.key === selectedKey) - Number(a.key === selectedKey) || Number(b.corroborated) - Number(a.corroborated) || arrivalOf(a) - arrivalOf(b)
  );
  const chosen = new Set(ranked.slice(0, limit).map((fact) => fact.key));
  const drawn = drawable.filter((fact) => chosen.has(fact.key));

  // Primary source: the one whose observation of the fact came first.
  const primaryOf = (fact: EvidenceFact): string => {
    const first = fact.observations.find((observation) => lane.has(observation.source))?.source;
    return first ?? fact.sourceIds.find((id) => lane.has(id)) ?? fact.sourceIds.at(0) ?? "";
  };
  const byPrimary = new Map<string, EvidenceFact[]>();
  for (const fact of drawn) {
    const id = primaryOf(fact);
    byPrimary.set(id, [...(byPrimary.get(id) ?? []), fact]);
  }
  for (const list of byPrimary.values()) {
    list.sort((a, b) => arrivalOf(a) - arrivalOf(b));
  }

  // Geometry
  // room for text to the right of a fact dot (its label starts 17 px past the dot)
  const labelBox = wide ? Math.min(320, Math.max(190, width * 0.36)) : Math.max(120, width - 92 - 25);
  const labelChars = Math.max(10, Math.floor((labelBox - 4) / 6.7));
  // The seed label is centred under the root dot in the wide tree, so the root sits far enough in for a long value not to be cut
  // at the left edge (long values are shortened to 18 characters; the full value stays in the accessible name and tooltip).
  const seedLabel = shorten(seed.value || "seed", wide ? 18 : labelChars);
  const seedX = wide ? Math.round(Math.max(40, Math.min(78, seedLabel.length * 3.7 + 16))) : 24;
  const factX = wide ? width - labelBox - 18 : 92;
  const sourceX = wide ? round(seedX + (factX - seedX) * 0.46) : 58;

  const nodes: TreeNode[] = [];
  const edges: TreeEdge[] = [];
  // the stack tree gives the seed its own first row; sources and facts follow
  let rowIndex = wide ? 0 : 1;
  const rowY = (index: number): number => pad + index * rowHeight + rowHeight / 2;
  let collapsedFacts = 0;
  interface Lane {
    readonly row: SourceRow;
    y: number;
    readonly facts: EvidenceFact[];
    readonly rowsStart: number;
  }
  const lanes: Lane[] = [];
  for (const row of rows) {
    const list = byPrimary.get(row.sourceId) ?? [];
    const isCollapsed = collapsed.has(row.sourceId);
    const shown = isCollapsed ? [] : list;
    if (isCollapsed) {
      collapsedFacts += list.length;
    }
    const start = rowIndex;
    if (wide) {
      // a source with facts spans their rows; one with none still takes a row of its own
      rowIndex += Math.max(1, shown.length);
      const first = rowY(start);
      const last = rowY(rowIndex - 1);
      lanes.push({ row, y: (first + last) / 2, facts: shown, rowsStart: start });
    } else {
      lanes.push({ row, y: rowY(rowIndex), facts: shown, rowsStart: rowIndex });
      rowIndex += 1 + shown.length;
    }
  }
  const factRows = new Map<string, number>();
  if (wide) {
    for (const entry of lanes) {
      entry.facts.forEach((fact, index) => factRows.set(fact.key, entry.rowsStart + index));
    }
  } else {
    for (const entry of lanes) {
      entry.facts.forEach((fact, index) => factRows.set(fact.key, entry.rowsStart + 1 + index));
    }
  }

  const seedY = wide ? (lanes.length > 0 ? ((lanes[0]?.y ?? rowY(0)) + (lanes.at(-1)?.y ?? rowY(0))) / 2 : rowY(0)) : rowY(0);

  nodes.push({
    id: "seed",
    kind: "seed",
    label: seedLabel,
    sub: seed.type,
    fullLabel: `${seed.type}: ${shorten(seed.value, 200)}`,
    x: seedX,
    y: seedY
  });

  const sourceNodeY = new Map<string, number>();
  for (const entry of lanes) {
    const { row } = entry;
    sourceNodeY.set(row.sourceId, entry.y);
    const hidden = collapsed.has(row.sourceId) ? (byPrimary.get(row.sourceId)?.length ?? 0) : 0;
    nodes.push({
      id: `source:${row.sourceId}`,
      kind: "source",
      label: shorten(row.label, wide ? 22 : labelChars),
      sub:
        row.state === "returned"
          ? undefined
          : row.state === "failed"
            ? (row.stateLabel === "Cancelled" ? "· cancelled" : "· failed")
            : row.state === "skipped"
              ? "· skipped"
              : activity.get(row.sourceId)?.state === "queued"
                ? "· queued"
                : activity.get(row.sourceId)?.state === "running"
                  ? "· running"
                  : "· reporting",
      fullLabel: `${row.label} · ${row.stateLabel}`,
      x: sourceX,
      y: entry.y,
      state: row.state,
      ...(row.cancelled === true ? { cancelled: true } : {}),
      sourceId: row.sourceId,
      drawnFacts: entry.facts.length,
      collapsed: collapsed.has(row.sourceId),
      hiddenFacts: hidden
    });
    edges.push({
      id: `queried:${row.sourceId}`,
      from: "seed",
      to: `source:${row.sourceId}`,
      role: "trunk",
      d: wide ? curve(seedX, seedY, sourceX, entry.y) : elbow(seedX, rowY(0), sourceX, entry.y),
      sourceId: row.sourceId,
      active: false,
      corroborated: false
    });
  }

  const factY = new Map<string, number>();
  for (const fact of drawn) {
    const rowOfFact = factRows.get(fact.key);
    if (rowOfFact !== undefined) {
      factY.set(fact.key, rowY(rowOfFact));
    }
  }
  const sourceLabelOf = new Map(rows.map((row) => [row.sourceId, row.label]));
  let shownFacts = 0;
  for (const fact of drawn) {
    const y = factY.get(fact.key);
    if (y === undefined) {
      continue; // hidden by a collapsed branch
    }
    shownFacts += 1;
    const primary = primaryOf(fact);
    const matched = fact.corroborated;
    nodes.push({
      id: `fact:${fact.key}`,
      kind: "fact",
      label: shorten(`${shorten(fact.type, 10)} · ${fact.value}`, labelChars),
      sub:
        fact.kind === "discovery"
          ? "Discovery link · not fetched evidence"
          : matched
            ? `Exact match · ${fact.upstreamFamilyIds.length} upstream families`
            : `Single source · ${shorten(sourceLabelOf.get(primary) ?? primary, 20)}`,
      fullLabel: `${shorten(fact.type, 60)}: ${shorten(fact.value, 200)} · ${fact.sourceIds.length} integration${fact.sourceIds.length === 1 ? "" : "s"}`,
      x: factX,
      y,
      factKey: fact.key,
      factKind: fact.kind,
      corroborated: matched,
      sourceCount: fact.upstreamFamilyIds.length
    });
    for (const sourceId of fact.sourceIds) {
      const sy = sourceNodeY.get(sourceId);
      if (sy === undefined) {
        continue;
      }
      const primaryEdge = sourceId === primary;
      const d = wide ? curve(sourceX, sy, factX, y) : primaryEdge ? elbow(sourceX, sy, factX, y) : sweep(sourceX, sy, factX, y);
      edges.push({
        id: `observed:${sourceId}:${fact.key}`,
        from: `source:${sourceId}`,
        to: `fact:${fact.key}`,
        role: primaryEdge ? "branch" : "cross",
        d,
        sourceId,
        factKey: fact.key,
        active: fact.key === selectedKey,
        corroborated: matched
      });
    }
  }

  const omittedFacts = drawable.length - drawn.length;
  let lastRow = rowIndex;
  if (omittedFacts > 0) {
    nodes.push({
      id: "more",
      kind: "more",
      label: `+${omittedFacts} more fact${omittedFacts === 1 ? "" : "s"}`,
      sub: "Open the evidence list",
      fullLabel: `${omittedFacts} more fact${omittedFacts === 1 ? "" : "s"} are in the evidence list`,
      x: wide ? factX : 58,
      y: rowY(lastRow)
    });
    lastRow += 1;
  }
  return {
    mode,
    width,
    height: Math.max(wide ? 240 : 200, pad * 2 + lastRow * rowHeight),
    rowHeight,
    nodes,
    edges,
    shownFacts,
    omittedFacts,
    collapsedFacts,
    labelChars
  };
}
