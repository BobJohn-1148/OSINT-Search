/**
 * Search is a correlation workspace, so the renderer shows one live tree instead
 * of ranked links. If source arrivals were hidden until completion, the user
 * could not see which passive sources corroborated or failed during fan-out.
 */
import { GitBranch, Play, Save, Search as SearchIcon, Square } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import type { Observation, SearchRunResult, SearchSeed, SearchTreeNode, SeedType, SourceStatus } from "../../shared/types/search";
import { seedTypeValues } from "../../shared/types/search";
import { useReacherClient } from "../hooks/use-reacher-client";

export function SearchView() {
  const { invoke } = useReacherClient();
  const [seedType, setSeedType] = useState<SeedType>("domain");
  const [seedValue, setSeedValue] = useState("example.com");
  const [run, setRun] = useState<SearchRunResult | null>(null);
  const [arrivals, setArrivals] = useState<SourceStatus[]>([]);
  const [liveObservations, setLiveObservations] = useState<Observation[]>([]);
  const [selectedNode, setSelectedNode] = useState<SearchTreeNode | null>(null);
  const [status, setStatus] = useState("Ready");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  useEffect(() => {
    const removeSourceListener = window.reacher.onSearchEvent("search:source-returned", (sourceStatus) => {
      setArrivals((current) => [...current, sourceStatus]);
    });
    const removeObservationListener = window.reacher.onSearchEvent("search:observations", (observations) => {
      setLiveObservations((current) => [...current, ...observations].slice(-500));
    });

    return () => {
      removeSourceListener();
      removeObservationListener();
    };
  }, []);

  const greeting = useMemo(() => timeGreeting(new Date()), []);
  const activeSeed: SearchSeed = { type: seedType, value: seedValue.trim() };
  const visibleTreeRows = useMemo(() => (run ? flattenTree(run.tree, 500) : []), [run]);

  async function runSearch(pivotSeed?: SearchSeed): Promise<void> {
    const seed = pivotSeed ?? activeSeed;
    if (!seed.value) {
      setStatus("Enter a seed before searching");
      return;
    }

    setRun(null);
    setSelectedNode(null);
    setArrivals([]);
    setLiveObservations([]);
    setStatus("Launching passive sources");
    const runId = crypto.randomUUID();
    setActiveRunId(runId);

    const result = await invoke(pivotSeed ? "search:pivot" : "search:run", { seed, runId });
    setActiveRunId(null);
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }

    setRun(result.value.run);
    setStatus("Search complete");
  }

  async function cancelSearch(): Promise<void> {
    if (!activeRunId) {
      return;
    }
    const result = await invoke("search:cancel", { runId: activeRunId });
    setStatus(result.ok && result.value.cancelled ? "Search cancelled" : "No active search to cancel");
    setActiveRunId(null);
  }

  return (
    <section className="route-surface" aria-labelledby="search-title">
      <header className="route-header">
        <p className="console-line">{greeting}</p>
        <h1 className="route-title" id="search-title">
          Search
        </h1>
        <p className="route-summary">Enter one seed and Reacher will build one cited, scored profile from passive sources.</p>
      </header>

      <div className="search-command-row">
        <label className="compact-field">
          Seed type
          <select className="field-control" value={seedType} onChange={(event) => setSeedType(event.target.value as SeedType)}>
            {seedTypeValues.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="compact-field">
          Seed
          <input className="field-control" value={seedValue} onChange={(event) => setSeedValue(event.target.value)} />
        </label>
        <button className="action-button" type="button" onClick={() => void runSearch()}>
          <Play size={16} aria-hidden="true" />
          Search
        </button>
        <button className="action-button" type="button" disabled={!activeRunId} onClick={() => void cancelSearch()}>
          <Square size={16} aria-hidden="true" />
          Cancel
        </button>
      </div>

      <div className="search-layout">
        <section className="console-panel settings-section" aria-labelledby="arrivals-title">
          <h2 className="section-title" id="arrivals-title">
            Live sources
          </h2>
          <div className="launch-meter" aria-label="Source loading animation">
            <SearchIcon size={18} aria-hidden="true" />
            <span>{status}</span>
          </div>
          <div className="table-list" role="list" aria-label="Source arrivals">
            {arrivals.map((source) => (
              <div className="provider-row" role="listitem" key={`${source.sourceId}-${source.status}`}>
                <div>
                  <div className="provider-name">{source.label}</div>
                  <div className="status-text">{source.status === "returned" ? `${source.observationCount} observations` : source.error}</div>
                </div>
                <span className="strength-pill">{source.status}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="console-panel settings-section" aria-labelledby="tree-title">
          <h2 className="section-title" id="tree-title">
            Correlation tree
          </h2>
          {run ? (
            <div className="tree-list">
              {visibleTreeRows.map((row) => (
                <TreeRowView
                  key={row.node.id}
                  row={row}
                  onSelect={setSelectedNode}
                  onPivot={(seed) => void runSearch(seed)}
                />
              ))}
              {visibleTreeRows.length === 500 ? <p className="status-text">More nodes buffered</p> : null}
            </div>
          ) : (
            <p className="status-text">No run yet</p>
          )}
        </section>

        <section className="console-panel settings-section" aria-labelledby="strength-title">
          <h2 className="section-title" id="strength-title">
            Strength
          </h2>
          <div className="table-list">
            {(run?.entities ?? []).map((entity) => (
              <div className="provider-row" key={entity.entity}>
                <div>
                  <div className="provider-name">{entity.value}</div>
                  <div className="status-text">{entity.sourceIds.join(", ")}</div>
                </div>
                <span className="strength-pill">{entity.band}</span>
              </div>
            ))}
          </div>
          <p className="status-text">{liveObservations.length} live observations received</p>
        </section>

        <section className="console-panel settings-section" aria-labelledby="details-title">
          <h2 className="section-title" id="details-title">
            Details
          </h2>
          {selectedNode ? (
            <>
              <p className="console-line">{selectedNode.label}</p>
              <p className="status-text">Trace: {selectedNode.sourceId ?? selectedNode.kind}</p>
              <div className="action-row">
                <button className="action-button" type="button">
                  <Save size={16} aria-hidden="true" />
                  Save node
                </button>
                {selectedNode.pivotSeed ? (
                  <button className="action-button" type="button" onClick={() => void runSearch(selectedNode.pivotSeed)}>
                    <GitBranch size={16} aria-hidden="true" />
                    Search this further
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <p className="status-text">Select a tree node to trace its sources.</p>
          )}
        </section>
      </div>
    </section>
  );
}

interface TreeRow {
  readonly node: SearchTreeNode;
  readonly depth: number;
}

function TreeRowView(props: {
  readonly row: TreeRow;
  readonly onSelect: (node: SearchTreeNode) => void;
  readonly onPivot: (seed: SearchSeed) => void;
}) {
  return (
    <div className="tree-node" style={{ "--tree-depth": props.row.depth } as CSSProperties}>
      <button className="tree-button" type="button" onClick={() => props.onSelect(props.row.node)}>
        <span>{props.row.node.label}</span>
        {props.row.node.band ? <span className="strength-pill">{props.row.node.band}</span> : null}
      </button>
    </div>
  );
}

function flattenTree(root: SearchTreeNode, limit: number): TreeRow[] {
  const rows: TreeRow[] = [];
  const visit = (node: SearchTreeNode, depth: number): void => {
    if (rows.length >= limit) {
      return;
    }
    rows.push({ node, depth });
    for (const child of node.children) {
      visit(child, depth + 1);
    }
  };

  visit(root, 0);
  return rows;
}

function timeGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) {
    return "Good morning, sir.";
  }
  if (hour < 18) {
    return "Good afternoon, sir.";
  }
  return "Good evening, sir.";
}
