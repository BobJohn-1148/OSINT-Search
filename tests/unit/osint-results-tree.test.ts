/**
 * The investigation tree is the run drawn as data: seed -> source -> fact, with one node per exact fact and a cross-link
 * for every extra source that returned it. These tests pin that no line is invented, that arrivals append instead of
 * reshuffling what is already on screen, and that the same evidence gives the same drawing at a given width.
 */
import { buildFacts, buildSourceRows } from "../../src/renderer/components/osint-results-model";
import { TREE_FACT_LIMIT, arrivalIndex, treeLayout, treeModeFor, type TreeModel } from "../../src/renderer/components/osint-results-tree";
import type { Observation, SourceStatus } from "../../src/shared/types/search";

const seed = { type: "domain" as const, value: "example.com" };

function obs(id: string, source: string, value: string, extra: Partial<Observation> = {}): Observation {
  return { id, runId: "run-1", entity: "example.com", type: "ip", value, source, confidence: 1, upstreamFamilyId: `family:${source}`, ...extra };
}

function build(observations: readonly Observation[], statuses: readonly SourceStatus[], width = 900, extra: { selectedKey?: string | null; collapsed?: ReadonlySet<string>; limit?: number } = {}): TreeModel {
  return treeLayout({
    seed,
    rows: buildSourceRows(statuses, observations),
    facts: buildFacts(observations),
    selectedKey: extra.selectedKey ?? null,
    width,
    collapsed: extra.collapsed,
    limit: extra.limit,
    arrival: arrivalIndex(observations)
  });
}

const ok = (sourceId: string, count = 1): SourceStatus => ({ sourceId, label: sourceId.toUpperCase(), status: "returned", observationCount: count });
const node = (tree: TreeModel, id: string) => tree.nodes.find((candidate) => candidate.id === id);

function endpoints(d: string): { from: [number, number]; to: [number, number] } {
  const numbers = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const from: [number, number] = [numbers[0] ?? NaN, numbers[1] ?? NaN];
  if (d.includes("V")) {
    // elbow: M x1 y1 V y2 H x2
    return { from, to: [numbers[3] ?? NaN, numbers[2] ?? NaN] };
  }
  return { from, to: [numbers.at(-2) ?? NaN, numbers.at(-1) ?? NaN] };
}

describe("tree structure", () => {
  const observations = [obs("a", "dns-a", "192.0.2.42"), obs("b", "dns-b", "192.0.2.42"), obs("c", "dns-c", "198.51.100.7")];
  const statuses = [ok("dns-a"), ok("dns-b"), ok("dns-c")];

  it("grows left to right on wide containers: seed, then sources, then facts", () => {
    const tree = build(observations, statuses);
    expect(tree.mode).toBe("wide");
    const seedNode = node(tree, "seed");
    const sources = tree.nodes.filter((candidate) => candidate.kind === "source");
    const facts = tree.nodes.filter((candidate) => candidate.kind === "fact");
    for (const source of sources) {
      expect(source.x).toBeGreaterThan(seedNode?.x ?? Infinity);
    }
    for (const fact of facts) {
      expect(fact.x).toBeGreaterThan(Math.max(...sources.map((source) => source.x)));
    }
  });

  it("draws a shared fact once, with its first source as the primary branch and the other source as a cross-link", () => {
    const tree = build(observations, statuses);
    const shared = tree.nodes.find((candidate) => candidate.kind === "fact" && candidate.corroborated);
    expect(tree.nodes.filter((candidate) => candidate.kind === "fact")).toHaveLength(2);
    expect(shared?.sub).toBe("Exact match · 2 upstream families");
    const edgesToShared = tree.edges.filter((edge) => edge.to === shared?.id);
    expect(edgesToShared.map((edge) => [edge.sourceId, edge.role])).toEqual([
      ["dns-a", "branch"],
      ["dns-b", "cross"]
    ]);
    expect(edgesToShared.every((edge) => edge.corroborated)).toBe(true);
  });

  it("keeps a conflicting value as its own leaf without match styling", () => {
    const tree = build(observations, statuses);
    const single = tree.nodes.find((candidate) => candidate.kind === "fact" && !candidate.corroborated);
    expect(single?.sub).toBe("Single source · DNS-C");
    expect(tree.edges.filter((edge) => edge.to === single?.id)).toHaveLength(1);
  });

  it("only draws lines a source's observation supports: seed to source and source to fact, nothing else", () => {
    const tree = build(observations, statuses);
    const kinds = new Map(tree.nodes.map((candidate) => [candidate.id, candidate.kind]));
    for (const edge of tree.edges) {
      expect(["seed>source", "source>fact"]).toContain(`${kinds.get(edge.from)}>${kinds.get(edge.to)}`);
    }
    const expectedObserved = new Set(buildFacts(observations).flatMap((fact) => fact.sourceIds.map((id) => `observed:${id}:${fact.key}`)));
    expect(new Set(tree.edges.filter((edge) => edge.role !== "trunk").map((edge) => edge.id))).toEqual(expectedObserved);
  });

  it("never draws a candidate association from current data", () => {
    expect(build(observations, statuses).edges.some((edge) => edge.role === "candidate")).toBe(false);
  });

  it("makes every path start and end at the nodes it joins", () => {
    for (const width of [900, 360]) {
      const tree = build(observations, statuses, width);
      const byId = new Map(tree.nodes.map((candidate) => [candidate.id, candidate]));
      for (const edge of tree.edges) {
        const { from, to } = endpoints(edge.d);
        const a = byId.get(edge.from);
        const b = byId.get(edge.to);
        expect(Math.abs(from[0] - (a?.x ?? NaN))).toBeLessThan(0.2);
        expect(Math.abs(from[1] - (a?.y ?? NaN))).toBeLessThan(0.2);
        expect(Math.abs(to[0] - (b?.x ?? NaN))).toBeLessThan(0.2);
        expect(Math.abs(to[1] - (b?.y ?? NaN))).toBeLessThan(0.2);
      }
    }
  });

  it("labels discovery links as leads rather than evidence, and never as matches", () => {
    const lead = (id: string, source: string): Observation => obs(id, source, "https://example.test/p", { kind: "discovery", type: "profile-url" });
    const tree = build([lead("l1", "dns-a"), lead("l2", "dns-b")], [ok("dns-a"), ok("dns-b")]);
    const fact = tree.nodes.find((candidate) => candidate.kind === "fact");
    expect(fact?.sub).toBe("Discovery link · not fetched evidence");
    expect(fact?.corroborated).toBe(false);
  });
});

describe("source states", () => {
  it("shows a failed source with its marker text and no fact branches, while the others stay", () => {
    const failed: SourceStatus = { sourceId: "site", label: "Website contacts", status: "failed", observationCount: 0, error: "Request timed out" };
    const tree = build([obs("a", "dns-a", "192.0.2.42")], [ok("dns-a"), failed]);
    const site = node(tree, "source:site");
    expect(site?.state).toBe("failed");
    expect(site?.sub).toBe("· failed");
    expect(tree.edges.filter((edge) => edge.sourceId === "site")).toHaveLength(1);
    expect(tree.edges.find((edge) => edge.sourceId === "site")?.role).toBe("trunk");
    expect(tree.nodes.filter((candidate) => candidate.kind === "fact")).toHaveLength(1);
  });

  it("keeps a long seed value inside the drawing: the root sits far enough in for its centred label", () => {
    const long = treeLayout({
      seed: { type: "email", value: "a-very-long-address-for-testing@example.com" },
      rows: buildSourceRows([ok("dns-a")], []),
      facts: [],
      selectedKey: null,
      width: 900
    });
    const seedNode = long.nodes.find((candidate) => candidate.kind === "seed");
    expect(seedNode?.label.length).toBeLessThanOrEqual(18);
    // the centred label is about 7 px per character wide: its left edge must not pass x = 0
    expect((seedNode?.x ?? 0) - ((seedNode?.label.length ?? 0) * 7) / 2).toBeGreaterThanOrEqual(0);
  });

  it("marks a cancelled source as cancelled on its branch, not failed", () => {
    const cancelled: SourceStatus = { sourceId: "c", label: "C", status: "failed", failureKind: "cancelled", observationCount: 0, error: "Cancelled" };
    const tree = build([obs("a", "dns-a", "192.0.2.42")], [ok("dns-a"), cancelled]);
    expect(node(tree, "source:c")?.sub).toBe("· cancelled");
    expect(node(tree, "source:c")?.cancelled).toBe(true);
    expect(tree.nodes.filter((candidate) => candidate.kind === "fact")).toHaveLength(1);
  });

  it("uses the branching canvas from the width the page really gives it at 1024 px viewports (about 560 px)", () => {
    expect(treeModeFor(559)).toBe("wide");
    expect(treeModeFor(520)).toBe("wide");
    expect(treeModeFor(519)).toBe("stack");
  });

  it("marks skipped and still-reporting sources distinctly", () => {
    const skipped: SourceStatus = { sourceId: "s", label: "S", status: "skipped", observationCount: 0, error: "policy" };
    const tree = build([obs("a", "late", "192.0.2.42")], [skipped]);
    expect(node(tree, "source:s")?.sub).toBe("· skipped");
    expect(node(tree, "source:late")?.sub).toBe("· reporting");
  });

  it("gives a source that returned nothing a branch row and no leaf", () => {
    const tree = build([], [ok("nvd", 0)]);
    expect(node(tree, "source:nvd")).toBeDefined();
    expect(tree.nodes.filter((candidate) => candidate.kind === "fact")).toHaveLength(0);
  });
});

describe("stability while a run grows", () => {
  it("appends rows: a new fact for the last source does not move any fact already drawn", () => {
    const first = [obs("a", "dns-a", "192.0.2.42"), obs("b", "dns-b", "198.51.100.7")];
    const before = build(first, [ok("dns-a"), ok("dns-b")]);
    const after = build([...first, obs("c", "dns-b", "203.0.113.9")], [ok("dns-a"), ok("dns-b")]);
    for (const existing of before.nodes.filter((candidate) => candidate.kind === "fact")) {
      const same = after.nodes.find((candidate) => candidate.id === existing.id);
      expect([same?.x, same?.y]).toEqual([existing.x, existing.y]);
    }
    expect(after.nodes.filter((candidate) => candidate.kind === "fact")).toHaveLength(3);
  });

  it("keeps arrival order within a source however the list sorts the facts", () => {
    const observations = [obs("z", "dns-a", "zzz"), obs("m", "dns-a", "mmm"), obs("a", "dns-a", "aaa")];
    const tree = build(observations, [ok("dns-a")]);
    const ys = ["zzz", "mmm", "aaa"].map((value) => tree.nodes.find((candidate) => candidate.fullLabel.includes(`: ${value} `))?.y ?? NaN);
    expect(ys[0]).toBeLessThan(ys[1] ?? NaN);
    expect(ys[1]).toBeLessThan(ys[2] ?? NaN);
  });

  it("is deterministic: the same evidence and width draw the same tree", () => {
    const observations = [obs("a", "dns-a", "192.0.2.42"), obs("b", "dns-b", "192.0.2.42")];
    expect(build(observations, [ok("dns-a"), ok("dns-b")], 777)).toEqual(build(observations, [ok("dns-a"), ok("dns-b")], 777));
  });
});

describe("capacity and branches", () => {
  const many = Array.from({ length: 100 }, (_, index) => obs(`m${index}`, `src-${index % 3}`, `host-${index}.example.com`, { type: "hostname" }));
  const rows = [ok("src-0"), ok("src-1"), ok("src-2")];

  it("draws at most the limit, reports the true overflow, and offers a +N more affordance to the full list", () => {
    const tree = build(many, rows);
    expect(tree.shownFacts).toBe(TREE_FACT_LIMIT);
    expect(tree.omittedFacts).toBe(100 - TREE_FACT_LIMIT);
    const more = node(tree, "more");
    expect(more?.label).toBe(`+${100 - TREE_FACT_LIMIT} more facts`);
    expect(more?.sub).toBe("Open the evidence list");
    expect(tree.height).toBeGreaterThan((more?.y ?? 0));
  });

  it("keeps the selected fact in the drawing even when it would not fit", () => {
    const target = buildFacts(many).find((fact) => fact.value === "host-99.example.com");
    const tree = build(many, rows, 900, { selectedKey: target?.key });
    expect(tree.nodes.some((candidate) => candidate.factKey === target?.key)).toBe(true);
    expect(tree.edges.filter((edge) => edge.active).length).toBe(1);
  });

  it("hides a collapsed branch's facts, counts them, and keeps its source node", () => {
    const tree = build(many.slice(0, 9), rows.slice(0, 3), 360, { collapsed: new Set(["src-1"]) });
    const branch = node(tree, "source:src-1");
    expect(branch?.collapsed).toBe(true);
    expect(branch?.hiddenFacts).toBe(3);
    expect(tree.collapsedFacts).toBe(3);
    expect(tree.edges.some((edge) => edge.sourceId === "src-1" && edge.role !== "trunk")).toBe(false);
    expect(tree.shownFacts).toBe(6);
  });
});

describe("vertical tree for phones", () => {
  const observations = [obs("a", "dns-a", "192.0.2.42"), obs("b", "dns-b", "192.0.2.42"), obs("c", "dns-b", "198.51.100.7")];
  const statuses = [ok("dns-a"), ok("dns-b")];

  it("switches shape below the wide breakpoint", () => {
    expect(treeModeFor(519)).toBe("stack");
    expect(treeModeFor(520)).toBe("wide");
  });

  it("stacks one node per row, indented by depth, with at least a 44 px row each", () => {
    const tree = build(observations, statuses, 360);
    expect(tree.mode).toBe("stack");
    const ordered = [...tree.nodes].sort((a, b) => a.y - b.y);
    for (let index = 1; index < ordered.length; index += 1) {
      expect((ordered[index]?.y ?? 0) - (ordered[index - 1]?.y ?? 0)).toBeGreaterThanOrEqual(44);
    }
    const seedNode = node(tree, "seed");
    for (const source of tree.nodes.filter((candidate) => candidate.kind === "source")) {
      expect(source.x).toBeGreaterThan(seedNode?.x ?? Infinity);
    }
    for (const fact of tree.nodes.filter((candidate) => candidate.kind === "fact")) {
      expect(fact.x).toBeGreaterThan(node(tree, "source:dns-a")?.x ?? Infinity);
    }
    expect(Math.max(...tree.nodes.map((candidate) => candidate.y))).toBeLessThan(tree.height);
  });

  it("keeps every label inside the drawing width", () => {
    const tree = build(observations, statuses, 320);
    for (const candidate of tree.nodes) {
      expect(candidate.x + 16 + (tree.labelChars * 6.7) / 1).toBeLessThanOrEqual(tree.width + 40);
    }
  });

  it("draws the same facts and the same observed lines as the wide tree", () => {
    const wide = build(observations, statuses, 900);
    const stack = build(observations, statuses, 360);
    expect(stack.edges.map((edge) => edge.id).sort()).toEqual(wide.edges.map((edge) => edge.id).sort());
    expect(stack.nodes.map((candidate) => candidate.id).sort()).toEqual(wide.nodes.map((candidate) => candidate.id).sort());
  });
});
