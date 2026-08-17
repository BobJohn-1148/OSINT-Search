/**
 * Search is a command workspace: one composer launches passive OSINT fan-out,
 * while the rails keep cases, monitoring, and agent plugins close enough to act
 * on evidence without burying the user in raw source output.
 */
import {
  Bot,
  Briefcase,
  FolderOpen,
  GitBranch,
  Globe,
  Image as ImageIcon,
  Play,
  Radar,
  Save,
  Search as SearchIcon,
  Square,
  Users
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AgentRecord } from "../../shared/schemas/agents";
import type { CaseRecord } from "../../shared/schemas/cases";
import type { MonitoringAlert, WatchRecord } from "../../shared/schemas/monitoring";
import type { Observation, SearchRunResult, SearchSeed, SearchTreeNode, SeedType, SourceStatus, StrengthBand } from "../../shared/types/search";
import { seedTypeValues } from "../../shared/types/search";
import { useReacherClient } from "../hooks/use-reacher-client";

type SearchEffort = "low" | "standard" | "deep";

const effortOptions: readonly { readonly id: SearchEffort; readonly label: string; readonly hint: string }[] = [
  { id: "low", label: "Low", hint: "Fast passive sweep" },
  { id: "standard", label: "Standard", hint: "Balanced OSINT fan-out" },
  { id: "deep", label: "Deep", hint: "Longer AI scrape timeout" }
];

export function SearchView() {
  const { invoke } = useReacherClient();
  const [seedType, setSeedType] = useState<SeedType>("domain");
  const [seedValue, setSeedValue] = useState("example.com");
  const [effort, setEffort] = useState<SearchEffort>("standard");
  const [imagePath, setImagePath] = useState("C:\\images\\subject.png");
  const [username, setUsername] = useState("jdoe");
  const [missionBrief, setMissionBrief] = useState("Find public evidence, cite sources, and flag pivots worth saving.");
  const [run, setRun] = useState<SearchRunResult | null>(null);
  const [arrivals, setArrivals] = useState<SourceStatus[]>([]);
  const [liveObservations, setLiveObservations] = useState<Observation[]>([]);
  const [selectedObservationId, setSelectedObservationId] = useState<string | null>(null);
  const [status, setStatus] = useState("Ready when you are");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [watches, setWatches] = useState<WatchRecord[]>([]);
  const [alerts, setAlerts] = useState<MonitoringAlert[]>([]);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("osint-agent");

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

  const refreshRails = useCallback(async (): Promise<void> => {
    const [caseResult, watchResult, agentResult] = await Promise.all([
      invoke("cases:list", {}),
      invoke("watch:list", {}),
      invoke("agents:list", {})
    ]);
    if (caseResult.ok) {
      setCases(Array.isArray(caseResult.value.cases) ? caseResult.value.cases.filter(isCaseRecord) : []);
    }
    if (watchResult.ok) {
      setWatches(Array.isArray(watchResult.value.watches) ? watchResult.value.watches.filter(Boolean) : []);
      setAlerts(Array.isArray(watchResult.value.alerts) ? watchResult.value.alerts.filter(Boolean) : []);
    }
    if (agentResult.ok) {
      const nextAgents = Array.isArray(agentResult.value.agents) ? agentResult.value.agents.filter(Boolean) : [];
      setAgents(nextAgents);
      setSelectedAgentId((current) => current || nextAgents[0]?.id || "osint-agent");
    }
  }, [invoke]);

  useEffect(() => {
    let mounted = true;
    void Promise.resolve().then(async () => {
      if (mounted) {
        await refreshRails();
      }
    });
    return () => {
      mounted = false;
    };
  }, [refreshRails]);

  const activeSeed: SearchSeed = useMemo(() => ({ type: seedType, value: seedValue.trim() }), [seedType, seedValue]);
  const observations = useMemo(() => observationsForOutput(run, liveObservations), [liveObservations, run]);
  const selectedObservation = selectedObservationId
    ? observations.find((observation) => observation.id === selectedObservationId) ?? firstItem(observations)
    : firstItem(observations);
  const previewUrl = useMemo(() => websitePreviewUrl(run?.seed ?? activeSeed), [activeSeed, run?.seed]);
  const sourceCounts = useMemo(() => sourceCountMap(observations), [observations]);
  const effectiveStatuses = run?.statuses ?? arrivals;
  const sourceSections = useMemo(() => groupObservationsBySource(observations, effectiveStatuses), [effectiveStatuses, observations]);
  const crossReferences = useMemo(() => buildCrossReferenceRows(run, observations), [observations, run]);
  const selectedCrossReference = selectedObservation ? crossReferences.find((row) => row.observations.some((item) => item.id === selectedObservation.id)) : null;
  const completedSources = effectiveStatuses.filter((source) => source.status === "returned").length;
  const failedSources = effectiveStatuses.filter((source) => source.status === "failed").length;
  const corroboratedFacts = crossReferences.filter((row) => row.strength > 1).length;

  async function runSearch(pivotSeed?: SearchSeed): Promise<void> {
    const seed = pivotSeed ?? activeSeed;
    if (!seed.value) {
      setStatus("Enter a seed before searching");
      return;
    }

    setRun(null);
    setSelectedObservationId(null);
    setArrivals([]);
    setLiveObservations([]);
    setStatus(`${effortLabel(effort)} search started`);
    const runId = crypto.randomUUID();
    setActiveRunId(runId);

    const result = await invoke(pivotSeed ? "search:pivot" : "search:run", { seed, runId, effort });
    setActiveRunId(null);
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }

    setRun(result.value.run);
    setSelectedObservationId(result.value.run.observations[0]?.id ?? null);
    setStatus(`Search complete with ${result.value.run.observations.length} observations`);
    await refreshRails();
  }

  async function cancelSearch(): Promise<void> {
    if (!activeRunId) {
      return;
    }
    const result = await invoke("search:cancel", { runId: activeRunId });
    setStatus(result.ok && result.value.cancelled ? "Search cancelled" : "No active search to cancel");
    setActiveRunId(null);
  }

  async function searchImage(): Promise<void> {
    const targetCase = await ensureCase();
    const result = await invoke("search:image", { imagePath, caseId: targetCase?.id });
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setRun(result.value.run);
    setSelectedObservationId(result.value.run.observations[0]?.id ?? null);
    setStatus(result.value.usedBrowserFallback ? "Image search used browser fallback" : "Image search complete");
  }

  async function pickImage(): Promise<void> {
    const result = await invoke("system:pickImage", {});
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    if (result.value.imagePath) {
      setImagePath(result.value.imagePath);
      setStatus("Image selected");
    }
  }

  async function usernameSweep(): Promise<void> {
    const targetCase = await ensureCase();
    const result = await invoke("search:usernameSweep", {
      username,
      wslDistro: "Ubuntu",
      caseId: targetCase?.id,
      sendToAgent: true
    });
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setRun(result.value.run);
    setSelectedObservationId(result.value.run.observations[0]?.id ?? null);
    setStatus(`Username sweep complete; saved:${result.value.savedItems}`);
  }

  async function saveSelectedObservation(): Promise<void> {
    if (!selectedObservation) {
      return;
    }
    const targetCase = await ensureCase();
    if (!targetCase) {
      return;
    }
    const result = await invoke("case:addItem", {
      caseId: targetCase.id,
      itemType: "observation",
      refId: selectedObservation.id,
      title: selectedObservation.value,
      text: selectedObservation.value,
      metadata: {
        entity: selectedObservation.entity,
        strength: selectedObservation.confidence,
        sourceId: selectedObservation.source,
        raw: selectedObservation.raw ?? {}
      }
    });
    setStatus(result.ok ? `Saved to ${targetCase.title}` : result.error.message);
    await refreshRails();
  }

  async function sendSelectedToAgent(): Promise<void> {
    if (!selectedObservation) {
      return;
    }
    const targetCase = await ensureCase();
    if (!targetCase) {
      return;
    }
    const result = await invoke("agent:run", {
      agentId: selectedAgentId,
      seed: pivotSeedForObservation(run?.seed.type ?? seedType, selectedObservation),
      caseId: targetCase.id,
      missionBrief: missionBrief.trim() || undefined
    });
    setStatus(result.ok ? `Sent to ${agentName(agents, selectedAgentId)} for ${targetCase.title}` : result.error.message);
  }

  async function ensureCase(): Promise<CaseRecord | null> {
    const existingOpenCase = cases.find((item) => item.status === "open") ?? firstItem(cases);
    if (existingOpenCase) {
      return existingOpenCase;
    }
    const createResult = await invoke("cases:create", { title: "Quick evidence", tags: ["search"] });
    if (!createResult.ok) {
      setStatus(createResult.error.message);
      return null;
    }
    const createdCase = valueAsCase(createResult.value);
    if (!createdCase) {
      setStatus("No case selected");
      return null;
    }
    setCases((current) => [createdCase, ...current]);
    return createdCase;
  }

  return (
    <section className="search-workspace" aria-labelledby="search-title">
      <aside className="search-rail" aria-label="Search workspace rail">
        <RailBlock icon={<Briefcase size={16} aria-hidden="true" />} title="Cases">
          {cases.slice(0, 6).map((item) => (
            <button className="rail-item" type="button" key={item.id} onClick={() => setMissionBrief(`Work this search into ${item.title}.`)}>
              <span>{item.title}</span>
              <small>{item.status}</small>
            </button>
          ))}
          {cases.length === 0 ? <p className="status-text">No cases yet.</p> : null}
        </RailBlock>

        <RailBlock icon={<Radar size={16} aria-hidden="true" />} title="Data monitoring">
          {watches.slice(0, 5).map((watch) => (
            <button
              className="rail-item"
              type="button"
              key={watch.id}
              onClick={() => {
                setSeedType(watch.type);
                setSeedValue(watch.value);
              }}
            >
              <span>{watch.value}</span>
              <small>{watch.lastCheckedTs ? "checked" : "new watch"}</small>
            </button>
          ))}
          {alerts.length > 0 ? <span className="rail-alert">{alerts.length} open alerts</span> : null}
          {watches.length === 0 ? <p className="status-text">No watch targets yet.</p> : null}
        </RailBlock>

        <RailBlock icon={<Bot size={16} aria-hidden="true" />} title="Agent plugins">
          {agents.map((agent) => (
            <button
              className="rail-item"
              type="button"
              aria-pressed={selectedAgentId === agent.id}
              key={agent.id}
              onClick={() => setSelectedAgentId(agent.id)}
            >
              <span>{agent.name}</span>
              <small>{agent.provider} / {agent.model}</small>
            </button>
          ))}
        </RailBlock>
      </aside>

      <main className="search-main" aria-labelledby="search-title">
        <div className="search-hero">
          <div>
            <p className="console-line">OSINT search console</p>
            <h1 className="route-title" id="search-title">
              Search
            </h1>
            <p className="route-summary">Ready when you are.</p>
          </div>
          <div className="search-effort-control" role="radiogroup" aria-label="Search effort">
            {effortOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className="effort-button"
                aria-checked={effort === option.id}
                role="radio"
                onClick={() => setEffort(option.id)}
              >
                <span>{option.label}</span>
                <small>{option.hint}</small>
              </button>
            ))}
          </div>
        </div>

        <section className="search-composer" aria-label="OSINT search composer">
          <div className="composer-grid">
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
            <label className="compact-field composer-seed">
              Search
              <div className="composer-input-shell">
                <SearchIcon size={18} aria-hidden="true" />
                <input className="composer-input" value={seedValue} onChange={(event) => setSeedValue(event.target.value)} />
              </div>
            </label>
            <button className="composer-icon-button" type="button" aria-label="Search" title="Search" onClick={() => void runSearch()}>
              <Play size={18} aria-hidden="true" />
            </button>
            <button className="composer-icon-button" type="button" aria-label="Cancel search" title="Cancel search" disabled={!activeRunId} onClick={() => void cancelSearch()}>
              <Square size={18} aria-hidden="true" />
            </button>
          </div>
          <label className="compact-field">
            Mission brief for agent handoff
            <textarea className="field-control mission-brief-input" value={missionBrief} onChange={(event) => setMissionBrief(event.target.value)} />
          </label>
          <div className="search-quick-tools">
            <label className="compact-field">
              Image path
              <input className="field-control" value={imagePath} onChange={(event) => setImagePath(event.target.value)} />
            </label>
            <button className="action-button" type="button" onClick={() => void pickImage()}>
              <FolderOpen size={16} aria-hidden="true" />
              Browse image
            </button>
            <button className="action-button" type="button" onClick={() => void searchImage()}>
              <ImageIcon size={16} aria-hidden="true" />
              Search image
            </button>
            <label className="compact-field">
              Username
              <input className="field-control" value={username} onChange={(event) => setUsername(event.target.value)} />
            </label>
            <button className="action-button" type="button" onClick={() => void usernameSweep()}>
              <Users size={16} aria-hidden="true" />
              Username sweep
            </button>
          </div>
          <span className="status-text" role="status">{status}</span>
        </section>

        <section className="search-results-layout" aria-label="Search output">
          <div className="search-evidence-panel">
            <div className="output-header">
              <div>
                <h2 className="section-title">Evidence output</h2>
                <p className="status-text">{observations.length} observations / {completedSources} sources returned / {failedSources} failed</p>
              </div>
              <span className="strength-pill">{corroboratedFacts} corroborated facts</span>
            </div>
            <div className="evidence-summary-grid" aria-label="Search evidence summary">
              <EvidenceMetric label="Unique facts" value={`${crossReferences.length}`} />
              <EvidenceMetric label="Corroborated" value={`${corroboratedFacts}`} />
              <EvidenceMetric label="Single-source" value={`${Math.max(0, crossReferences.length - corroboratedFacts)}`} />
            </div>
            <section className="cross-reference-board" aria-labelledby="cross-reference-title">
              <div className="source-evidence-header">
                <div>
                  <h3 id="cross-reference-title">Cross-reference board</h3>
                  <p className="status-text">Facts are grouped by matching entity, type, and value across independent sources.</p>
                </div>
                <span className="strength-pill">{corroboratedFacts} matched</span>
              </div>
              <div className="cross-reference-list" role="list" aria-label="Cross-referenced facts">
                {crossReferences.map((row) => (
                  <button
                    className="cross-reference-row"
                    type="button"
                    key={row.key}
                    onClick={() => setSelectedObservationId(row.observations[0]?.id ?? null)}
                  >
                    <div className="cross-reference-main">
                      <span className="evidence-type">{row.type}</span>
                      <strong>{row.value}</strong>
                      <small>{row.entity}</small>
                    </div>
                    <div className="cross-reference-sources" aria-label={`${row.sourceIds.length} matching sources`}>
                      {row.sourceIds.map((sourceId) => (
                        <span key={sourceId}>{sourceId}</span>
                      ))}
                    </div>
                    <span className={`confidence-pill confidence-${row.band}`}>{confidenceLabel(row.band)}</span>
                  </button>
                ))}
                {crossReferences.length === 0 ? <p className="status-text">Search observations will be cross-referenced here as sources return.</p> : null}
              </div>
            </section>
            <div className="source-section-list">
              {sourceSections.map((section) => (
                <section className="source-evidence-section" key={section.sourceId} aria-labelledby={`source-${section.sourceId}`}>
                  <div className="source-evidence-header">
                    <div>
                      <h3 id={`source-${section.sourceId}`}>{section.label}</h3>
                      <p className="status-text">{section.observations.length} observations from {section.sourceId}</p>
                    </div>
                    <span className={`source-status-pill source-status-${section.status}`}>{section.status}</span>
                  </div>
                  <div className="evidence-list" role="list">
                    {section.observations.map((observation) => {
                      const band = observationBand(run, observation);
                      return (
                        <button
                          className="evidence-row"
                          type="button"
                          aria-pressed={selectedObservation?.id === observation.id}
                          key={observation.id}
                          onClick={() => setSelectedObservationId(observation.id)}
                        >
                          <span className="evidence-type">{observation.type}</span>
                          <strong>{observation.value}</strong>
                          <span className="status-text">{observation.entity}</span>
                          <span className={`confidence-pill confidence-${band}`}>{confidenceLabel(band)}</span>
                          {observationSourceUrl(observation) ? <small>{observationSourceUrl(observation)}</small> : null}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
              {observations.length === 0 ? <p className="status-text">Run a search to build a cited evidence feed.</p> : null}
            </div>
          </div>

          <aside className="search-detail-panel" aria-label="Search detail">
            <section className="detail-section">
              <div className="output-header">
                <h2 className="section-title">Website preview</h2>
                <Globe size={18} aria-hidden="true" />
              </div>
              {previewUrl ? (
                <iframe className="website-preview" title={`Preview of ${previewUrl}`} src={previewUrl} sandbox="allow-same-origin allow-scripts" />
              ) : (
                <p className="status-text">Domain searches show a live website preview here.</p>
              )}
            </section>

            <section className="detail-section">
              <h2 className="section-title">Source plugins</h2>
              <div className="source-plugin-grid">
                {effectiveStatuses.map((source) => (
                  <div className="source-plugin" key={`${source.sourceId}-${source.status}`}>
                    <span>{source.label}</span>
                    <strong>{source.status === "returned" ? `${source.observationCount}` : "failed"}</strong>
                  </div>
                ))}
                {effectiveStatuses.length === 0 ? <p className="status-text">Sources appear as they return.</p> : null}
              </div>
            </section>

            <section className="detail-section">
              <h2 className="section-title">Selected evidence</h2>
              {selectedObservation ? (
                <div className="selected-evidence">
                  <span className="mono-cell">{selectedObservation.source}</span>
                  <strong>{selectedObservation.value}</strong>
                  <p className="status-text">{selectedObservation.type} linked to {selectedObservation.entity}</p>
                  <div className="selected-evidence-meta">
                    <span className={`confidence-pill confidence-${observationBand(run, selectedObservation)}`}>{confidenceLabel(observationBand(run, selectedObservation))}</span>
                    {observationSourceUrl(selectedObservation) ? <span>{observationSourceUrl(selectedObservation)}</span> : null}
                  </div>
                  {selectedCrossReference ? (
                    <div className="cross-reference-detail">
                      <strong>Cross-reference</strong>
                      <span>{crossReferenceExplanation(selectedCrossReference)}</span>
                      <div className="cross-reference-sources">
                        {selectedCrossReference.sourceIds.map((sourceId) => (
                          <span key={sourceId}>{sourceId}</span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="action-row">
                    <button className="action-button" type="button" onClick={() => void saveSelectedObservation()}>
                      <Save size={16} aria-hidden="true" />
                      Save node
                    </button>
                    <button className="action-button" type="button" onClick={() => void sendSelectedToAgent()}>
                      <Bot size={16} aria-hidden="true" />
                      Send to agent
                    </button>
                    <button
                      className="action-button"
                      type="button"
                      onClick={() => void runSearch(pivotSeedForObservation(run?.seed.type ?? seedType, selectedObservation))}
                    >
                      <GitBranch size={16} aria-hidden="true" />
                      Pivot
                    </button>
                  </div>
                </div>
              ) : (
                <p className="status-text">Select evidence to save, pivot, or hand to an agent.</p>
              )}
            </section>

            <section className="detail-section">
              <h2 className="section-title">Source density</h2>
              <div className="density-list">
                {[...sourceCounts.entries()].map(([source, count]) => (
                  <div className="density-row" key={source}>
                    <span>{source}</span>
                    <strong>{count}</strong>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </section>
      </main>
    </section>
  );
}

function RailBlock(props: { readonly icon: ReactNode; readonly title: string; readonly children: ReactNode }) {
  return (
    <div className="rail-block">
      <div className="rail-title-row">
        {props.icon}
        <span>{props.title}</span>
      </div>
      <div className="rail-list">{props.children}</div>
    </div>
  );
}

function EvidenceMetric(props: { readonly label: string; readonly value: string }) {
  return (
    <div className="evidence-metric">
      <strong>{props.value}</strong>
      <span>{props.label}</span>
    </div>
  );
}

interface SourceEvidenceSection {
  readonly sourceId: string;
  readonly label: string;
  readonly status: SourceStatus["status"];
  readonly observations: readonly Observation[];
}

interface CrossReferenceRow {
  readonly key: string;
  readonly entity: string;
  readonly type: string;
  readonly value: string;
  readonly sourceIds: readonly string[];
  readonly strength: number;
  readonly band: StrengthBand;
  readonly observations: readonly Observation[];
}

function buildCrossReferenceRows(run: SearchRunResult | null, observations: readonly Observation[]): CrossReferenceRow[] {
  const grouped = new Map<string, Observation[]>();
  for (const observation of observations) {
    const key = factKey(observation);
    grouped.set(key, [...(grouped.get(key) ?? []), observation]);
  }

  const runEntities = run?.entities ?? [];
  return [...grouped.entries()]
    .map(([key, groupedObservations]) => {
      const first = groupedObservations[0];
      const matchingEntity = runEntities.find((entity) => factKey(entity) === key);
      const sourceIds = matchingEntity?.sourceIds ?? [...new Set(groupedObservations.map((observation) => observation.source))].sort();
      const strength = matchingEntity?.strength ?? sourceIds.length;
      const band = matchingEntity?.band ?? bandFromStrength(strength);
      return {
        key,
        entity: first.entity,
        type: first.type,
        value: first.value,
        sourceIds,
        strength,
        band,
        observations: groupedObservations
      };
    })
    .sort((a, b) => b.strength - a.strength || a.type.localeCompare(b.type) || a.value.localeCompare(b.value));
}

function bandFromStrength(strength: number): StrengthBand {
  if (strength >= 4) {
    return "confirmed";
  }
  if (strength === 3) {
    return "strong";
  }
  if (strength === 2) {
    return "likely";
  }
  return "single-source";
}

function crossReferenceExplanation(row: CrossReferenceRow): string {
  if (row.strength <= 1) {
    return "Only one source reported this fact. Treat it as a lead until another source agrees.";
  }
  return `${row.sourceIds.length} independent sources reported the same ${row.type}: ${row.sourceIds.join(", ")}.`;
}

function groupObservationsBySource(
  observations: readonly Observation[],
  statuses: readonly SourceStatus[]
): SourceEvidenceSection[] {
  const sections = new Map<string, SourceEvidenceSection>();
  for (const status of statuses) {
    sections.set(status.sourceId, {
      sourceId: status.sourceId,
      label: status.label,
      status: status.status,
      observations: []
    });
  }

  for (const observation of observations) {
    const existing = sections.get(observation.source);
    const nextObservations = [...(existing?.observations ?? []), observation];
    sections.set(observation.source, {
      sourceId: observation.source,
      label: existing?.label ?? sourceLabel(observation.source),
      status: existing?.status ?? "returned",
      observations: nextObservations
    });
  }

  return [...sections.values()]
    .filter((section) => section.observations.length > 0 || section.status === "failed")
    .sort((a, b) => b.observations.length - a.observations.length || a.label.localeCompare(b.label));
}

function sourceCountMap(observations: readonly Observation[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const observation of observations) {
    counts.set(observation.source, (counts.get(observation.source) ?? 0) + 1);
  }
  return counts;
}

function observationsForOutput(run: SearchRunResult | null, liveObservations: readonly Observation[]): Observation[] {
  if (!run) {
    return [...liveObservations];
  }
  if (run.observations.length > 0) {
    return [...run.observations];
  }
  return treeObservations(run.tree, run.runId, run.seed);
}

function treeObservations(root: SearchTreeNode, runId: string, seed: SearchSeed): Observation[] {
  const observations: Observation[] = [];
  const visit = (node: SearchTreeNode): void => {
    if (node.kind === "observation" && node.observationId) {
      observations.push({
        id: node.observationId,
        runId,
        entity: node.entity ?? seed.value,
        type: seed.type,
        value: node.label,
        source: node.sourceId ?? "search",
        confidence: node.strength ?? 1,
        raw: { treeNodeId: node.id }
      });
    }
    for (const child of node.children) {
      visit(child);
    }
  };
  visit(root);
  return observations;
}

function observationBand(run: SearchRunResult | null, observation: Observation): StrengthBand {
  const entity = run?.entities.find((candidate) => factKey(candidate) === factKey(observation));
  return entity?.band ?? "single-source";
}

function factKey(fact: Pick<Observation, "entity" | "type" | "value">): string {
  return `${normalizeFactText(fact.entity)}\u0000${normalizeFactText(fact.type)}\u0000${normalizeFactText(fact.value)}`;
}

function normalizeFactText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function confidenceLabel(band: StrengthBand): string {
  if (band === "single-source") {
    return "single source";
  }
  if (band === "likely") {
    return "2 sources";
  }
  if (band === "strong") {
    return "3 sources";
  }
  return "4+ sources";
}

function observationSourceUrl(observation: Observation): string | null {
  const sourceUrl = observation.raw?.sourceUrl;
  return typeof sourceUrl === "string" && sourceUrl.length > 0 ? sourceUrl : null;
}

function websitePreviewUrl(seed: SearchSeed): string | null {
  if (seed.type !== "domain" || !seed.value.trim()) {
    return null;
  }
  const value = seed.value.trim();
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function pivotSeedForObservation(fallbackType: SeedType, observation: Observation): SearchSeed {
  const type = seedTypeValues.includes(observation.type as SeedType) ? (observation.type as SeedType) : fallbackType;
  return { type, value: observation.raw?.treeNodeId ? observation.entity : observation.value };
}

function agentName(agents: readonly AgentRecord[], agentId: string): string {
  if (agentId === "osint-agent") {
    return agents.find((agent) => agent.id === agentId)?.name ?? "OSINT agent";
  }
  return agents.find((agent) => agent.id === agentId)?.name ?? agentId;
}

function firstItem<T>(items: readonly T[]): T | null {
  for (const item of items) {
    return item;
  }
  return null;
}

function valueAsCase(value: unknown): CaseRecord | null {
  if (!value || typeof value !== "object" || !("case" in value)) {
    return null;
  }
  return isCaseRecord(value.case) ? value.case : null;
}

function isCaseRecord(value: unknown): value is CaseRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<CaseRecord>;
  return typeof candidate.id === "string" && typeof candidate.title === "string" && typeof candidate.status === "string";
}

function effortLabel(effort: SearchEffort): string {
  return effortOptions.find((option) => option.id === effort)?.label ?? "Standard";
}

function sourceLabel(source: string): string {
  return source.toUpperCase();
}
