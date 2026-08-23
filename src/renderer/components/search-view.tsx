/**
 * Search is a correlation workspace, so the renderer shows one live tree instead
 * of ranked links. If source arrivals were hidden until completion, the user
 * could not see which passive sources corroborated or failed during fan-out.
 *
 * The surface has two faces: an empty "ready when you are" composer with a right
 * rail (cases, monitoring, agent plugins), and — once a run returns — an
 * intelligence board that reads the same run every other panel does: a fact
 * summary, a cross-reference of what corroborates what, a subject profile, the
 * source plugins that answered, and the corroborated/verified feeds. The tree
 * and node details stay so evidence is still selectable and saveable.
 */
import {
  Bot,
  CheckCircle2,
  ExternalLink,
  GitBranch,
  Globe,
  Layers,
  Mail,
  Paperclip,
  Play,
  Save,
  Search as SearchIcon,
  ShieldCheck,
  Square,
  UserRound
} from "lucide-react";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import type { AgentRecord } from "../../shared/schemas/agents";
import type { CaseRecord } from "../../shared/schemas/cases";
import type { WatchRecord } from "../../shared/schemas/monitoring";
import type { Observation, SearchRunResult, SearchSeed, SearchTreeNode, SeedType, SourceStatus } from "../../shared/types/search";
import { seedTypeValues } from "../../shared/types/search";
import { useReacherClient } from "../hooks/use-reacher-client";

/** Router state shape when another surface (e.g. malware triage) pivots a seed in. */
interface SearchLocationState {
  readonly seed?: { readonly type?: string; readonly value?: string };
}

type SearchDepth = "low" | "standard" | "deep";

export function SearchView() {
  const { invoke } = useReacherClient();
  const location = useLocation();
  const pivotSeed = (location.state as SearchLocationState | null)?.seed;
  const [pivotType] = useState<SeedType | null>(() =>
    pivotSeed?.type && (seedTypeValues as readonly string[]).includes(pivotSeed.type) ? (pivotSeed.type as SeedType) : null
  );
  const [seedValue, setSeedValue] = useState(() => pivotSeed?.value ?? "");
  const [depth, setDepth] = useState<SearchDepth>("standard");
  const [run, setRun] = useState<SearchRunResult | null>(null);
  const [arrivals, setArrivals] = useState<SourceStatus[]>([]);
  const [liveObservations, setLiveObservations] = useState<Observation[]>([]);
  const [selectedNode, setSelectedNode] = useState<SearchTreeNode | null>(null);
  const [status, setStatus] = useState(() => (pivotSeed?.value ? "Seed pivoted in — review, then search" : "Ready when you are."));
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [loadingLabel, setLoadingLabel] = useState("");
  // Right-rail context. Loaded defensively: these channels may be absent in some
  // harnesses, so a malformed response can never crash the composer.
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [watches, setWatches] = useState<WatchRecord[]>([]);
  const [agents, setAgents] = useState<AgentRecord[]>([]);

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

  const loadContext = useCallback(async (): Promise<void> => {
    const [casesResult, watchResult, agentsResult] = await Promise.all([
      invoke("cases:list", {}),
      invoke("watch:list", {}),
      invoke("agents:list", {})
    ]);
    if (casesResult.ok) {
      setCases(asArray(casesResult.value.cases));
    }
    if (watchResult.ok) {
      setWatches(asArray(watchResult.value.watches));
    }
    if (agentsResult.ok) {
      setAgents(asArray(agentsResult.value.agents));
    }
  }, [invoke]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadContext(), 0);
    return () => window.clearTimeout(timer);
  }, [loadContext]);

  const greeting = useMemo(() => timeGreeting(new Date()), []);
  const detectedType = useMemo<SeedType>(() => detectSeedType(seedValue) ?? pivotType ?? "domain", [seedValue, pivotType]);
  const activeSeed: SearchSeed = { type: detectedType, value: seedValue.trim() };
  const visibleTreeRows = useMemo(() => (run ? flattenTree(run.tree, 500) : []), [run]);
  const selectedObservation = useMemo(() => {
    if (!run || !selectedNode?.observationId) {
      return null;
    }
    return run.observations.find((observation) => observation.id === selectedNode.observationId) ?? null;
  }, [run, selectedNode]);
  const selectedLookupUrl = lookupUrlFromObservation(selectedObservation);
  const board = useMemo(() => (run ? computeBoard(run) : null), [run]);

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
    setLoadingLabel("Running correlation search");
    const runId = crypto.randomUUID();
    setActiveRunId(runId);
    const result = await invoke(pivotSeed ? "search:pivot" : "search:run", { seed, runId });
    setActiveRunId(null);
    if (!result.ok) {
      setStatus(result.error.message);
      setLoadingLabel("");
      return;
    }
    setRun(result.value.run);
    setStatus("Search complete");
    setLoadingLabel("");
  }

  async function cancelSearch(): Promise<void> {
    if (!activeRunId) {
      return;
    }
    const result = await invoke("search:cancel", { runId: activeRunId });
    setStatus(result.ok && result.value.cancelled ? "Search cancelled" : "No active search to cancel");
    setActiveRunId(null);
    setLoadingLabel("");
  }

  async function attachAndSearchImage(): Promise<void> {
    const picked = await invoke("system:pickImage", {});
    if (!picked.ok) {
      setStatus(picked.error.message);
      return;
    }
    if (!picked.value.imagePath) {
      return;
    }
    setLoadingLabel("Reverse image searching");
    const targetCase = await ensureCase();
    const result = await invoke("search:image", { imagePath: picked.value.imagePath, caseId: targetCase?.id });
    if (!result.ok) {
      setStatus(result.error.message);
      setLoadingLabel("");
      return;
    }
    setRun(result.value.run);
    setSelectedNode(null);
    setStatus(result.value.usedBrowserFallback ? "Image search used browser fallback" : "Image search complete");
    setLoadingLabel("");
  }

  async function runOceanAgent(): Promise<void> {
    if (!activeSeed.value) {
      setStatus("Enter something to investigate first");
      return;
    }
    setLoadingLabel("Running Ocean agent");
    const targetCase = await ensureCase();
    const result = await invoke("agent:run", { agentId: "osint-agent", seed: activeSeed, caseId: targetCase?.id });
    setStatus(result.ok ? "Ocean agent is investigating — check the AI agents tab" : result.error.message);
    setLoadingLabel("");
  }

  async function saveSelectedNode(): Promise<void> {
    if (!selectedNode) {
      return;
    }
    setLoadingLabel("Saving selected node");
    const targetCase = await ensureCase();
    if (!targetCase) {
      setLoadingLabel("");
      return;
    }
    const result = await invoke("case:addItem", {
      caseId: targetCase.id,
      itemType: "observation",
      refId: selectedNode.observationId ?? selectedNode.id,
      title: selectedNode.label,
      text: selectedNode.label,
      metadata: {
        entity: selectedNode.entity ?? selectedNode.label,
        strength: selectedNode.strength ?? 1,
        band: selectedNode.band ?? "single-source",
        sourceId: selectedNode.sourceId
      }
    });
    setStatus(result.ok ? `Saved to ${targetCase.title}` : result.error.message);
    setLoadingLabel("");
  }

  async function saveRecord(): Promise<void> {
    if (!run) {
      return;
    }
    setLoadingLabel("Saving record");
    const targetCase = await ensureCase();
    if (!targetCase) {
      setLoadingLabel("");
      return;
    }
    const facts = run.entities.slice(0, 12).map((entity) => `${entity.type}: ${entity.value} (${entity.band})`).join("\n");
    const result = await invoke("case:addItem", {
      caseId: targetCase.id,
      itemType: "observation",
      refId: run.runId,
      title: `Profile — ${run.seed.value}`,
      text: facts || run.seed.value,
      metadata: { entity: run.seed.value, band: "single-source", strength: 1 }
    });
    setStatus(result.ok ? `Record saved to ${targetCase.title}` : result.error.message);
    setLoadingLabel("");
  }

  async function sendSelectedNodeToAgent(): Promise<void> {
    if (!selectedNode) {
      return;
    }
    setLoadingLabel("Sending node to agent");
    const targetCase = await ensureCase();
    if (!targetCase) {
      setLoadingLabel("");
      return;
    }
    const seed = selectedNode.pivotSeed ?? { type: run?.seed.type ?? detectedType, value: selectedNode.entity ?? selectedNode.label };
    const result = await invoke("agent:run", { agentId: "osint-agent", seed, caseId: targetCase.id });
    setStatus(result.ok ? `Sent to OSINT agent for ${targetCase.title}` : result.error.message);
    setLoadingLabel("");
  }

  async function ensureCase(): Promise<CaseRecord | null> {
    const listResult = await invoke("cases:list", {});
    if (!listResult.ok) {
      setStatus(listResult.error.message);
      return null;
    }
    const existingOpenCase = asArray(listResult.value.cases).find((item) => item.status === "open") ?? null;
    if (existingOpenCase) {
      return existingOpenCase;
    }
    const all = asArray(listResult.value.cases);
    if (all.length > 0) {
      return all[0];
    }
    const createResult = await invoke("cases:create", { title: "Quick evidence", tags: ["search"] });
    if (!createResult.ok) {
      setStatus(createResult.error.message);
      return null;
    }
    return createResult.value.case;
  }

  return (
    <section className="route-surface search-surface" aria-labelledby="search-title">
      <div className="search-workspace">
        <div className="search-main-column">
          <header className="search-home">
            <h1 className="route-title search-greeting" id="search-title">
              {greeting}, User.
            </h1>
            <p className="search-subtitle">Ready when you are.</p>
            <div className="search-composer">
              <span className="search-seed-detected" aria-label="Detected seed type" title="Auto-detected from what you type">
                {seedValue.trim() ? detectedType : "auto"}
              </span>
              <input
                className="search-main-input"
                aria-label="Seed"
                placeholder="Enter seed, image, or description… (Auto-detect active)"
                value={seedValue}
                onChange={(event) => setSeedValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void runSearch();
                  }
                }}
              />
              <button
                className="icon-button"
                type="button"
                aria-label="Attach image for reverse search"
                title="Attach image for reverse search"
                onClick={() => void attachAndSearchImage()}
              >
                <Paperclip size={17} aria-hidden="true" />
              </button>
              <div className="search-depth" role="group" aria-label="Search depth">
                {(["low", "standard", "deep"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={depth === option ? "search-depth-option is-active" : "search-depth-option"}
                    aria-pressed={depth === option}
                    onClick={() => setDepth(option)}
                  >
                    {option === "low" ? "Low" : option === "standard" ? "Standard" : "Deep"}
                  </button>
                ))}
              </div>
              <button
                className={activeRunId ? "icon-button search-submit is-active" : "icon-button search-submit"}
                type="button"
                aria-label="Search"
                title="Search"
                onClick={() => void runSearch()}
              >
                <Play size={17} aria-hidden="true" />
              </button>
              <button className="icon-button" type="button" aria-label="Cancel" title="Cancel" disabled={!activeRunId} onClick={() => void cancelSearch()}>
                <Square size={17} aria-hidden="true" />
              </button>
            </div>
            <div className="search-actions">
              <button className="action-button primary-action" type="button" onClick={() => void runOceanAgent()}>
                <Bot size={16} aria-hidden="true" />
                Run Ocean agent
              </button>
              <span className="route-summary">{status}</span>
            </div>
          </header>

          {run && board ? (
            <div className="search-board">
              <section className="console-panel intel-summary-panel" aria-labelledby="intel-summary-title">
                <div className="section-title-row section-title-row-wide">
                  <h2 className="section-title" id="intel-summary-title">Search intelligence summary</h2>
                  <span className="status-text">
                    {board.observationCount} observations: {board.returnedCount} sources returned / {board.failedCount} failed
                  </span>
                </div>
                <div className="intel-stat-row">
                  <IntelStat label="Unique facts" value={board.uniqueFacts} />
                  <IntelStat label="Corroborated" value={board.corroborated.length} tone="positive" />
                  <IntelStat label="Single source" value={board.singleSource.length} tone="muted" />
                </div>
              </section>

              <div className="search-board-columns">
                <div className="search-board-main">
                  {depth !== "low" ? (
                    <section className="console-panel" aria-labelledby="crossref-title">
                      <div className="section-title-row section-title-row-wide">
                        <h2 className="section-title" id="crossref-title">
                          <Layers size={15} aria-hidden="true" /> Cross-reference board
                        </h2>
                        <span className="status-text">{board.corroborated.length} watched</span>
                      </div>
                      {board.corroborated.length === 0 ? (
                        <p className="status-text">Facts are cross-referenced here as independent sources corroborate them.</p>
                      ) : (
                        <div className="crossref-grid">
                          {board.corroborated.slice(0, 8).map((entity) => (
                            <div className="crossref-card" key={`${entity.type}-${entity.value}`}>
                              <strong>{entity.value}</strong>
                              <span className="status-text">{entity.type} · {entity.sourceIds.length} sources</span>
                              <span className={`strength-pill band-${entity.band}`}>{entity.band}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  ) : null}

                  <section className="console-panel" aria-labelledby="corroborated-title">
                    <h2 className="section-title" id="corroborated-title">Corroborated facts</h2>
                    <div className="fact-table" role="table" aria-label="Corroborated facts">
                      <div className="fact-head" role="row">
                        <span role="columnheader">Fact type</span>
                        <span role="columnheader">Detail</span>
                        <span role="columnheader">Status</span>
                      </div>
                      {board.corroborated.map((entity) => (
                        <div className="fact-row" role="row" key={`${entity.type}-${entity.value}`}>
                          <span className="fact-type" role="cell">{entity.type}</span>
                          <span className="fact-detail" role="cell">{entity.value}</span>
                          <span className="fact-status is-confirmed" role="cell">
                            <CheckCircle2 size={13} aria-hidden="true" /> {bandStatusLabel(entity.band)}
                          </span>
                        </div>
                      ))}
                      {board.corroborated.length === 0 ? <p className="status-text">No corroborated facts yet.</p> : null}
                    </div>
                  </section>

                  {depth !== "low" ? (
                    <section className="console-panel" aria-labelledby="feed-title">
                      <h2 className="section-title" id="feed-title">Verified intelligence feed</h2>
                      <div className="fact-table" role="table" aria-label="Verified intelligence feed">
                        <div className="fact-head" role="row">
                          <span role="columnheader">Fact type</span>
                          <span role="columnheader">Source</span>
                          <span role="columnheader">Status</span>
                        </div>
                        {board.feed.slice(0, depth === "deep" ? 40 : 12).map((item) => (
                          <div className="fact-row" role="row" key={item.id}>
                            <span className="fact-type" role="cell">{item.type}</span>
                            <span className="fact-detail" role="cell">{item.source}</span>
                            <span className={item.verified ? "fact-status is-confirmed" : "fact-status"} role="cell">
                              {item.verified ? <CheckCircle2 size={13} aria-hidden="true" /> : null}
                              {item.verified ? "Confirmed" : "Observed"}
                            </span>
                          </div>
                        ))}
                        {board.feed.length === 0 ? <p className="status-text">No observations received yet.</p> : null}
                      </div>
                    </section>
                  ) : null}

                  <section className="console-panel" aria-labelledby="tree-title">
                    <h2 className="section-title" id="tree-title">Correlation tree</h2>
                    <div className="tree-list">
                      {visibleTreeRows.map((row) => (
                        <TreeRowView key={row.node.id} row={row} onSelect={setSelectedNode} />
                      ))}
                      {visibleTreeRows.length === 500 ? <p className="status-text">More nodes buffered</p> : null}
                    </div>
                  </section>
                </div>

                <div className="search-board-side">
                  <section className="console-panel profile-card" aria-labelledby="profile-title">
                    <h2 className="section-title" id="profile-title">{run.seed.value} — {seedTypeNoun(run.seed.type)}</h2>
                    <div className="profile-head">
                      <span className="profile-avatar" aria-hidden="true"><UserRound size={26} /></span>
                      <div className="profile-summary">
                        <strong>{run.seed.value}</strong>
                        <span className="status-text">{board.uniqueFacts} facts · {board.returnedCount} sources</span>
                      </div>
                    </div>
                    <dl className="profile-facts">
                      {board.profileFacts.map((fact) => (
                        <div className="profile-fact" key={`${fact.type}-${fact.value}`}>
                          <dt>{fact.type}</dt>
                          <dd>{fact.value}</dd>
                        </div>
                      ))}
                      {board.profileFacts.length === 0 ? <p className="status-text">No structured facts extracted.</p> : null}
                    </dl>
                    <div className="action-row">
                      {board.viewSourceUrl ? (
                        <a className="action-button" href={board.viewSourceUrl} target="_blank" rel="noreferrer">
                          <ExternalLink size={15} aria-hidden="true" />
                          View source
                        </a>
                      ) : null}
                      <button className="action-button primary-action" type="button" onClick={() => void saveRecord()}>
                        <Save size={15} aria-hidden="true" />
                        Save record
                      </button>
                    </div>
                  </section>

                  <section className="console-panel" aria-labelledby="sources-title">
                    <h2 className="section-title" id="sources-title">Source plugins</h2>
                    <div className="source-plugin-list">
                      {board.sources.map((source) => (
                        <div className="source-plugin-row" key={source.sourceId}>
                          <span className={source.status === "returned" ? "status-dot status-dot-verified" : "status-dot status-dot-error"} aria-hidden="true" />
                          <span className="source-plugin-name">{source.label}</span>
                          <span className="status-text">{source.status === "returned" ? `${source.observationCount}` : "failed"}</span>
                        </div>
                      ))}
                      {board.sources.length === 0 ? <p className="status-text">No sources answered yet.</p> : null}
                    </div>
                  </section>

                  {selectedNode ? (
                    <section className="console-panel" aria-labelledby="node-details-title">
                      <h2 className="section-title" id="node-details-title">Node details</h2>
                      <p className="console-line">{selectedNode.label}</p>
                      <p className="status-text">Trace: {selectedNode.sourceId ?? selectedNode.kind}</p>
                      <div className="action-row">
                        <button className="action-button" type="button" onClick={() => void saveSelectedNode()}>
                          <Save size={15} aria-hidden="true" />
                          Save node
                        </button>
                        <button className="action-button" type="button" onClick={() => void sendSelectedNodeToAgent()}>
                          <Bot size={15} aria-hidden="true" />
                          Send to agent
                        </button>
                        {selectedNode.pivotSeed ? (
                          <button className="action-button" type="button" onClick={() => void runSearch(selectedNode.pivotSeed)}>
                            <GitBranch size={15} aria-hidden="true" />
                            Search this further
                          </button>
                        ) : null}
                        {selectedLookupUrl ? (
                          <a className="action-button" href={selectedLookupUrl} target="_blank" rel="noreferrer">
                            <ExternalLink size={15} aria-hidden="true" />
                            Open lookup
                          </a>
                        ) : null}
                      </div>
                    </section>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="search-live-hint" aria-live="polite">
              {activeRunId ? (
                <div className="launch-meter is-active">
                  <SearchIcon size={18} aria-hidden="true" />
                  <span>{status} · {arrivals.length} sources · {liveObservations.length} observations</span>
                </div>
              ) : (
                <p className="status-text">Type a seed and search — sources fan out in parallel and merge into one profile.</p>
              )}
            </div>
          )}
        </div>

        <aside className="search-rail" aria-label="Context">
          <section className="console-panel search-rail-panel" aria-labelledby="rail-cases-title">
            <h2 className="section-title" id="rail-cases-title">Cases</h2>
            <div className="rail-list">
              {cases.slice(0, 6).map((caseRecord) => (
                <div className="rail-row" key={caseRecord.id}>
                  <strong>{caseRecord.title}</strong>
                  <span className="status-text">{caseRecord.status}</span>
                </div>
              ))}
              {cases.length === 0 ? <p className="status-text">No cases yet.</p> : null}
            </div>
          </section>

          <section className="console-panel search-rail-panel" aria-labelledby="rail-monitor-title">
            <h2 className="section-title" id="rail-monitor-title">Data monitoring</h2>
            <div className="rail-list">
              {watches.slice(0, 8).map((watch) => (
                <div className="rail-row" key={watch.id}>
                  {watch.type === "domain" ? <Globe size={13} aria-hidden="true" /> : <Mail size={13} aria-hidden="true" />}
                  <span className="rail-row-target">{watch.value}</span>
                  <span className="status-text">checked</span>
                </div>
              ))}
              {watches.length === 0 ? <p className="status-text">No monitored targets.</p> : null}
            </div>
          </section>

          <section className="console-panel search-rail-panel" aria-labelledby="rail-agents-title">
            <h2 className="section-title" id="rail-agents-title">Agent plugins</h2>
            <div className="rail-list">
              {agents.slice(0, 8).map((agent) => (
                <div className={agent.id === "osint-agent" ? "rail-agent-row is-active" : "rail-agent-row"} key={agent.id}>
                  <ShieldCheck size={14} aria-hidden="true" />
                  <div className="rail-agent-identity">
                    <strong>{agent.name}</strong>
                    <span className="status-text">{agent.provider} / {agent.model}</span>
                  </div>
                </div>
              ))}
              {agents.length === 0 ? <p className="status-text">No agents configured.</p> : null}
            </div>
          </section>
        </aside>
      </div>
      {loadingLabel ? <div className="route-loading" role="status">{loadingLabel}</div> : null}
    </section>
  );
}

interface TreeRow {
  readonly node: SearchTreeNode;
  readonly depth: number;
}

function TreeRowView(props: { readonly row: TreeRow; readonly onSelect: (node: SearchTreeNode) => void }) {
  return (
    <div className="tree-node" style={{ "--tree-depth": props.row.depth } as CSSProperties}>
      <button className="tree-button" type="button" onClick={() => props.onSelect(props.row.node)}>
        <span>{props.row.node.label}</span>
        {props.row.node.band ? <span className="strength-pill">{props.row.node.band}</span> : null}
      </button>
    </div>
  );
}

function IntelStat(props: { readonly label: string; readonly value: number; readonly tone?: "positive" | "muted" }) {
  return (
    <div className={`intel-stat intel-stat-${props.tone ?? "default"}`}>
      <strong>{props.value}</strong>
      <span>{props.label}</span>
    </div>
  );
}

interface FeedItem {
  readonly id: string;
  readonly type: string;
  readonly source: string;
  readonly verified: boolean;
}

interface BoardData {
  readonly uniqueFacts: number;
  readonly corroborated: SearchRunResult["entities"];
  readonly singleSource: SearchRunResult["entities"];
  readonly sources: readonly SourceStatus[];
  readonly returnedCount: number;
  readonly failedCount: number;
  readonly observationCount: number;
  readonly feed: readonly FeedItem[];
  readonly profileFacts: readonly { readonly type: string; readonly value: string }[];
  readonly viewSourceUrl: string | null;
}

function computeBoard(run: SearchRunResult): BoardData {
  const corroborated = run.entities.filter((entity) => entity.band !== "single-source");
  const singleSource = run.entities.filter((entity) => entity.band === "single-source");
  const returned = run.statuses.filter((status) => status.status === "returned");
  const failed = run.statuses.filter((status) => status.status === "failed");
  const corroboratedValues = new Set(corroborated.map((entity) => entity.value.toLowerCase()));
  const feed: FeedItem[] = run.observations.map((observation) => ({
    id: observation.id,
    type: observation.type,
    source: observation.source,
    verified: corroboratedValues.has(observation.value.toLowerCase())
  }));
  const profileFacts = [...run.entities]
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 6)
    .map((entity) => ({ type: entity.type, value: entity.value }));
  const viewSourceUrl = firstLookupUrl(run.observations);
  return {
    uniqueFacts: run.entities.length,
    corroborated,
    singleSource,
    sources: run.statuses,
    returnedCount: returned.length,
    failedCount: failed.length,
    observationCount: run.observations.length,
    feed,
    profileFacts,
    viewSourceUrl
  };
}

function firstLookupUrl(observations: readonly Observation[]): string | null {
  for (const observation of observations) {
    const url = lookupUrlFromObservation(observation);
    if (url) {
      return url;
    }
  }
  return null;
}

function bandStatusLabel(band: string): string {
  if (band === "confirmed") {
    return "Confirmed";
  }
  if (band === "strong") {
    return "Strong";
  }
  return "Likely";
}

function seedTypeNoun(type: SeedType): string {
  switch (type) {
    case "name":
      return "person profile";
    case "email":
      return "email profile";
    case "domain":
      return "domain profile";
    case "ip":
      return "host profile";
    case "phone":
      return "phone profile";
    case "business":
      return "business profile";
    default:
      return "profile";
  }
}

/** Coerce a possibly-absent array (defensive against harness stubs) to an array. */
function asArray<T>(value: readonly T[] | undefined): T[] {
  // Array.isArray narrows to any[]; re-assert the element type before copying so
  // a malformed response yields an empty list instead of an unsafe spread.
  return Array.isArray(value) ? (value as readonly T[]).slice() : [];
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

/**
 * Infer the seed type from what the investigator typed so there is no seed-type
 * control to manage. Ordered most-specific first; a single bare token defaults to
 * a username, a multi-word value to a name.
 */
function detectSeedType(value: string): SeedType | null {
  const text = value.trim();
  if (!text) {
    return null;
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
    return "email";
  }
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(text)) {
    return "ip";
  }
  if (/^[0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){5}$/.test(text)) {
    return "mac";
  }
  const digits = text.replace(/[^\d]/g, "");
  if (/^\+?[\d().\-\s]{7,}$/.test(text) && digits.length >= 7 && digits.length <= 15) {
    return "phone";
  }
  if (/^https?:\/\//i.test(text) || /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(text)) {
    return "domain";
  }
  return /\s/.test(text) ? "name" : "username";
}

function timeGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) {
    return "Good morning";
  }
  if (hour < 18) {
    return "Good afternoon";
  }
  return "Good evening";
}

function lookupUrlFromObservation(observation: Observation | null): string | null {
  const lookupUrl = observation?.raw?.lookupUrl;
  return typeof lookupUrl === "string" && /^https:\/\//i.test(lookupUrl) ? lookupUrl : null;
}
