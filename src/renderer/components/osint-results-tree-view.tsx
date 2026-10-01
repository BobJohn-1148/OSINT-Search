/**
 * The evidence tree draws the run as it grows: the seed is the root, each source is a branch, each fact is a leaf, and
 * a fact that several sources returned is one leaf with a cross-link from every extra source. It draws only what the
 * evidence supports (see osint-results-tree.ts) and never replaces the evidence list: every fact here is also a row
 * in the list, and the tree is a second, spatial way in. Proximity on the screen is never evidence of association.
 *
 * Animation is layered on top of that truth and can never hide it: arrivals are drawn immediately and are selectable at
 * once, the pings are one-shot overlays (a ring on the shared leaf, a lit path from the newly contributing source),
 * and a match keeps a permanent outline plus the words "Exact match" so nothing depends on seeing the motion. The
 * in-app Motion switch, prefers-reduced-motion and a hidden page all stop the decoration without stopping updates.
 *
 * The camera (pan and zoom) lives in this component's state and is never reset by arrivals, filters, selection or
 * resizing; only the Fit button resets it. Rejected: wheel zoom, because it hijacks page scrolling; and a fixed-height
 * viewport with an inner scroller, because on a phone that is a scroll trap. The drawing is as tall as its rows and the
 * page scrolls past it.
 */
import { Minus, Plus, ScanSearch } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import type { SearchSeed } from "../../shared/types/search";
import "../osint-results-tree.css";
import { type EvidenceFact, type SourceRow } from "./osint-results-model";
import { arrivalIndex, treeLayout, type SourceLifecycle, type TreeNode } from "./osint-results-tree";
import type { ArrivalMotion } from "./use-arrival-motion";

interface Camera {
  readonly zoom: number;
  /** Origin of the visible window, in drawing units. Anchored to the top left so new rows never move the view. */
  readonly x: number;
  readonly y: number;
}

const FIT: Camera = { zoom: 1, x: 0, y: 0 };
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 3;
const WRAP_PADDING = 24;
const WIDTH_TOLERANCE = 3;
const DEFAULT_WIDTH = 760;

const pathStyle = (d: string, delay?: number): CSSProperties => {
  const style: Record<string, string> = { d: `path("${d}")` };
  if (delay !== undefined) {
    style["--osr-delay"] = `${delay}ms`;
  }
  return style;
};
const delayStyle = (delay: number): CSSProperties => ({ ["--osr-delay" as string]: `${delay}ms` });

export function OsintResultsTree(props: {
  readonly seed: SearchSeed;
  readonly rows: readonly SourceRow[];
  readonly facts: readonly EvidenceFact[];
  /** Observations in arrival order, so branches keep arrival order however the list is sorted. */
  readonly observations: readonly { readonly entity: string; readonly type: string; readonly value: string }[];
  readonly selectedFactKey: string | null;
  readonly onSelectFact: (fact: EvidenceFact) => void;
  readonly onShowAll: () => void;
  readonly running: boolean;
  readonly motion: ArrivalMotion;
  /** Per-source lifecycle, supplied only when the backend really reports it. */
  readonly sourceActivity?: ReadonlyMap<string, SourceLifecycle>;
}) {
  const { seed, rows, facts, observations, selectedFactKey, onSelectFact, onShowAll, running, motion, sourceActivity } = props;
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [camera, setCamera] = useState<Camera>(FIT);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const arrival = useMemo(() => arrivalIndex(observations), [observations]);
  const tree = useMemo(
    () => treeLayout({ seed, rows, facts, selectedKey: selectedFactKey, width, collapsed, arrival, activity: sourceActivity }),
    [seed, rows, facts, selectedFactKey, width, collapsed, arrival, sourceActivity]
  );
  const factsByKey = useMemo(() => new Map(facts.map((fact) => [fact.key, fact])), [facts]);

  const factNodes = useMemo(() => tree.nodes.filter((node) => node.kind === "fact").sort((a, b) => a.y - b.y), [tree.nodes]);
  const selectedNode = selectedFactKey ? factNodes.find((node) => node.factKey === selectedFactKey) : undefined;
  const tabStopId = selectedNode?.id ?? factNodes.at(0)?.id ?? null;
  const stack = tree.mode === "stack";
  const { recent } = motion;

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) {
      return undefined;
    }
    const measure = (): void => {
      const room = element.clientWidth - WRAP_PADDING;
      if (room > 0) {
        setWidth((current) => (Math.abs(current - room) > WIDTH_TOLERANCE ? room : current));
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const viewW = tree.width / camera.zoom;
  const viewH = tree.height / camera.zoom;
  const zoomBy = (factor: number): void =>
    setCamera((current) => {
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.zoom * factor));
      const cx = current.x + tree.width / current.zoom / 2;
      const cy = current.y + tree.height / current.zoom / 2;
      return { zoom, x: cx - tree.width / zoom / 2, y: cy - tree.height / zoom / 2 };
    });

  function onPointerDown(event: PointerEvent<SVGSVGElement>): void {
    drag.current = { x: event.clientX, y: event.clientY, cx: camera.x, cy: camera.y };
    // jsdom (the test environment) has no pointer capture; real Chromium does.
    const capture = Reflect.get(event.currentTarget, "setPointerCapture") as unknown;
    if (typeof capture === "function") {
      capture.call(event.currentTarget, event.pointerId);
    }
  }
  function onPointerMove(event: PointerEvent<SVGSVGElement>): void {
    const start = drag.current;
    const box = svgRef.current?.getBoundingClientRect();
    if (!start || !box || box.width === 0) {
      return;
    }
    const scale = viewW / box.width;
    setCamera((current) => ({ ...current, x: start.cx - (event.clientX - start.x) * scale, y: start.cy - (event.clientY - start.y) * scale }));
  }
  const endDrag = (): void => {
    drag.current = null;
  };

  function focusFact(from: TreeNode, step: number): void {
    if (factNodes.length === 0) {
      return;
    }
    const index = factNodes.findIndex((node) => node.id === from.id);
    const next = factNodes[(Math.max(index, 0) + step + factNodes.length) % factNodes.length];
    const fact = next.factKey ? factsByKey.get(next.factKey) : undefined;
    if (!fact) {
      return;
    }
    onSelectFact(fact);
    // Selecting never moves the camera or steals focus except here, where the person is arrowing through the nodes.
    const target = [...(svgRef.current?.querySelectorAll<SVGGElement>("[data-node-id]") ?? [])].find((element) => element.dataset.nodeId === next.id);
    target?.focus();
  }
  function onFactKey(event: KeyboardEvent<SVGGElement>, node: TreeNode, fact: EvidenceFact): void {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectFact(fact);
    } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      focusFact(node, 1);
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      focusFact(node, -1);
    }
  }
  const toggleBranch = (sourceId: string): void =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(sourceId)) {
        next.add(sourceId);
      }
      return next;
    });

  const sourceCount = rows.length;
  const className = [
    "osr-tree",
    motion.motionOn ? "is-motion-on" : "is-motion-off",
    selectedNode ? "has-selection" : "",
    motion.pageHidden ? "is-page-hidden" : ""
  ]
    .filter(Boolean)
    .join(" ");
  const matchedWord = (node: TreeNode): string => (node.corroborated ? ` Exact match across ${node.sourceCount ?? 0} upstream families.` : "");

  return (
    <section className="osr-panel osr-graph-panel" aria-labelledby="osr-graph-title">
      <div className="osr-panel-head">
        <div>
          <h2 className="osr-panel-title" id="osr-graph-title">
            Evidence tree
          </h2>
          <p className="osr-panel-sub">Branches are sources, leaves are returned facts. Proximity is not evidence of association.</p>
        </div>
        <div className="osr-toolbar" role="group" aria-label="Evidence tree controls">
          <button className="osr-btn osr-btn-icon" type="button" aria-label="Zoom out" disabled={camera.zoom <= MIN_ZOOM} onClick={() => zoomBy(1 / 1.25)}>
            <Minus size={16} aria-hidden="true" />
          </button>
          <button className="osr-btn osr-btn-icon" type="button" aria-label="Zoom in" disabled={camera.zoom >= MAX_ZOOM} onClick={() => zoomBy(1.25)}>
            <Plus size={16} aria-hidden="true" />
          </button>
          <button className="osr-btn" type="button" onClick={() => setCamera(FIT)}>
            <ScanSearch size={16} aria-hidden="true" />
            Fit
          </button>
          <button
            className="osr-btn"
            type="button"
            aria-pressed={motion.userMotion && !motion.reduced}
            disabled={motion.reduced}
            title={motion.reduced ? "Motion is off because reduced motion is on in your system settings" : "Turn decorative motion on or off. Results keep updating either way."}
            onClick={() => motion.setUserMotion(!motion.userMotion)}
          >
            Motion {motion.motionOn ? "on" : "off"}
          </button>
        </div>
      </div>
      <div className="osr-graph-wrap" ref={wrapRef}>
        <>
          <svg
            ref={svgRef}
            className={className}
            viewBox={`${camera.x} ${camera.y} ${viewW} ${viewH}`}
            preserveAspectRatio="xMinYMin meet"
            style={{ height: tree.height }}
            role="group"
            aria-label={`Evidence tree for ${seed.type} ${seed.value}: ${sourceCount} source${sourceCount === 1 ? "" : "s"}, ${tree.shownFacts} fact${tree.shownFacts === 1 ? "" : "s"} drawn`}
            data-zoom={camera.zoom.toFixed(2)}
            data-mode={tree.mode}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <g aria-hidden="true">
              {tree.edges.map((edge) => {
                const mark = recent.edges.get(edge.id);
                return (
                  <path
                    key={edge.id}
                    d={edge.d}
                    pathLength={1}
                    className={`osr-t-edge osr-t-edge-${edge.role}${edge.corroborated ? " is-matched" : ""}${edge.active ? " is-active" : ""}${mark ? " is-new" : ""}`}
                    style={pathStyle(edge.d, mark?.delay)}
                  />
                );
              })}
              {tree.edges.map((edge) => {
                const ping = recent.edgePings.get(edge.id);
                return ping ? <path key={`ping:${edge.id}:${ping.token}`} d={edge.d} className="osr-t-edge-ping" style={delayStyle(ping.delay)} /> : null;
              })}
            </g>
            {tree.nodes.map((node) => {
              const mark = recent.nodes.get(node.id);
              const transform = { transform: `translate(${node.x}px, ${node.y}px)` } as CSSProperties;
              if (node.kind === "seed") {
                return (
                  <g key={node.id} // the root settles in when a run begins; the class is only present while a run is running, so reopening a saved case does not play it
                  className={`osr-t-node osr-t-seed${running ? " is-running is-entering" : ""}`} style={transform} role="img" aria-label={`Seed ${node.fullLabel}`}>
                    <circle className="osr-t-halo" r={20} />
                    <g className="osr-t-body">
                      <circle className="osr-t-dot" r={15} />
                      <text className="osr-t-label osr-t-label-strong" x={stack ? 24 : 0} y={stack ? -1 : 34} textAnchor={stack ? "start" : "middle"}>
                        {node.label}
                      </text>
                      <text className="osr-t-sub" x={stack ? 24 : 0} y={stack ? 13 : 48} textAnchor={stack ? "start" : "middle"}>
                        {node.sub}
                      </text>
                    </g>
                  </g>
                );
              }
              if (node.kind === "source") {
                const state = node.state ?? "returned";
                const activity = sourceActivity?.get(node.sourceId ?? "")?.state;
                const toggle = stack && (node.drawnFacts ?? 0) + (node.hiddenFacts ?? 0) > 0;
                const interactive = toggle ? { role: "button" as const, tabIndex: 0, "aria-expanded": !node.collapsed, "aria-label": `${node.collapsed ? "Expand" : "Collapse"} ${node.fullLabel} branch, ${(node.drawnFacts ?? 0) + (node.hiddenFacts ?? 0)} facts` } : { role: "img" as const, "aria-label": `Source ${node.fullLabel}` };
                return (
                  <g
                    key={node.id}
                    className={`osr-t-node osr-t-source is-${state}${mark ? " is-new" : ""}${activity === "running" ? " is-running" : ""}${activity === "queued" ? " is-queued" : ""}${recent.failed.has(node.sourceId ?? "") ? " is-just-failed" : ""}${toggle ? " osr-t-toggle" : ""}`}
                    style={transform}
                    {...interactive}
                    {...(toggle
                      ? {
                          onClick: () => toggleBranch(node.sourceId ?? ""),
                          onKeyDown: (event: KeyboardEvent<SVGGElement>) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              toggleBranch(node.sourceId ?? "");
                            }
                          },
                          onPointerDown: (event: PointerEvent<SVGGElement>) => event.stopPropagation()
                        }
                      : {})}
                  >
                    {toggle ? <circle className="osr-t-hit" r={22} /> : null}
                    <circle className="osr-t-halo" r={16} />
                    <g className="osr-t-body" style={mark ? delayStyle(mark.delay) : undefined}>
                      <circle className="osr-t-dot" r={11} />
                      {state === "failed" ? (
                        <text className="osr-t-mark" textAnchor="middle" y={4.5}>
                          !
                        </text>
                      ) : null}
                      {stack ? (
                        <>
                          <text className="osr-t-label" x={20} y={-1}>
                            {node.label}
                            {node.collapsed ? ` (+${node.hiddenFacts ?? 0})` : ""}
                          </text>
                          {node.sub ? (
                            <text className="osr-t-sub" x={20} y={13}>
                              {node.sub}
                            </text>
                          ) : null}
                        </>
                      ) : (
                        // wide tree: the state sits on the name's own line, so a source with no facts (one short row) never has its
                        // state text crowd the branch below it
                        <text className="osr-t-label" x={0} y={-18} textAnchor="middle">
                          {node.label}
                          {node.sub ? (
                            <tspan className="osr-t-sub" dx={6}>
                              {node.sub}
                            </tspan>
                          ) : null}
                        </text>
                      )}
                    </g>
                    {toggle ? <circle className="osr-t-focus" r={19} /> : null}
                  </g>
                );
              }
              if (node.kind === "more") {
                return (
                  <g
                    key={node.id}
                    className="osr-t-node osr-t-more osr-t-toggle"
                    style={transform}
                    role="button"
                    tabIndex={0}
                    aria-label={`${node.fullLabel}. Open the evidence list`}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={onShowAll}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onShowAll();
                      }
                    }}
                  >
                    <circle className="osr-t-hit" r={22} />
                    <g className="osr-t-body">
                      <circle className="osr-t-dot" r={7} />
                      <text className="osr-t-label" x={16} y={-1}>
                        {node.label}
                      </text>
                      <text className="osr-t-sub" x={16} y={13}>
                        {node.sub}
                      </text>
                    </g>
                    <circle className="osr-t-focus" r={19} />
                  </g>
                );
              }
              const fact = node.factKey ? factsByKey.get(node.factKey) : undefined;
              if (!fact) {
                return null;
              }
              const selected = node.factKey === selectedFactKey;
              const ping = recent.pings.get(node.id);
              return (
                <g
                  key={node.id}
                  className={`osr-t-node osr-t-fact${node.corroborated ? " is-matched" : ""}${selected ? " is-selected" : ""}${node.factKind === "discovery" ? " is-discovery" : ""}${mark ? " is-new" : ""}`}
                  style={transform}
                  data-node-id={node.id}
                  role="button"
                  tabIndex={node.id === tabStopId ? 0 : -1}
                  aria-pressed={selected}
                  aria-label={`${node.fullLabel}.${matchedWord(node)}${node.factKind === "discovery" ? " Discovery link, not fetched evidence." : ""}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => onSelectFact(fact)}
                  onKeyDown={(event) => onFactKey(event, node, fact)}
                >
                  <title>{node.fullLabel}</title>
                  <circle className="osr-t-hit" r={22} />
                  {ping ? <circle key={`ring:${ping.token}`} className="osr-t-ping" r={11} style={delayStyle(ping.delay)} /> : null}
                  <g className="osr-t-body" style={mark ? delayStyle(mark.delay) : undefined}>
                    <circle className="osr-t-dot" r={8} />
                    <text className="osr-t-label" x={17} y={-1}>
                      {node.label}
                    </text>
                    <text className="osr-t-sub" x={17} y={13}>
                      {node.sub}
                    </text>
                  </g>
                  <circle className="osr-t-focus" r={15} />
                </g>
              );
            })}
          </svg>
          {rows.length === 0 && facts.length === 0 && (sourceActivity?.size ?? 0) === 0 ? (
            <p className="osr-t-empty">{running ? "Waiting for the first source to answer…" : "Run a search to grow the tree. Branches appear only when a source returns."}</p>
          ) : null}
        </>
      </div>
      {motion.latestText ? (
        <p className="osr-t-arrival">
          Latest: <strong>{motion.latestText}</strong>
        </p>
      ) : null}
      <p className="osr-sr-only" role="status" aria-live="polite">
        {motion.announcement}
      </p>
      <div className="osr-t-legend" aria-label="Evidence tree legend">
        <span className="osr-t-legend-item"><i className="osr-t-key" aria-hidden="true" />Seed to source: the source was asked</span>
        <span className="osr-t-legend-item"><i className="osr-t-key osr-t-key-branch" aria-hidden="true" />Source to fact: it returned this</span>
        <span className="osr-t-legend-item"><i className="osr-t-key osr-t-key-branch is-match" aria-hidden="true" />Exact-match path (stays lit)</span>
        <span className="osr-t-legend-item"><i className="osr-t-key osr-t-key-cross" aria-hidden="true" />Cross-link: another source returned the same exact fact</span>
        <span className="osr-t-legend-item"><i className="osr-t-dotkey osr-t-dotkey-match" aria-hidden="true" />Exact match (outline and badge stay)</span>
        <span className="osr-t-legend-item"><i className="osr-t-dotkey osr-t-dotkey-failed" aria-hidden="true" />Failed source (marker and reason)</span>
      </div>
      {tree.omittedFacts > 0 ? (
        <>
          <p className="osr-note" role="note">
            Drawing {tree.shownFacts + tree.collapsedFacts} of {tree.shownFacts + tree.collapsedFacts + tree.omittedFacts} facts (selected and exact matches first). All {tree.shownFacts + tree.collapsedFacts + tree.omittedFacts} are in the evidence list.
          </p>
          <button className="osr-btn osr-t-more-button" type="button" onClick={onShowAll}>
            Show all {tree.shownFacts + tree.collapsedFacts + tree.omittedFacts} facts in the list
          </button>
        </>
      ) : null}
      {tree.collapsedFacts > 0 ? (
        <p className="osr-note" role="note">
          {tree.collapsedFacts} fact{tree.collapsedFacts === 1 ? " is" : "s are"} hidden in collapsed branches; expand a branch to draw {tree.collapsedFacts === 1 ? "it" : "them"}. They are all in the evidence list.
        </p>
      ) : null}
    </section>
  );
}
