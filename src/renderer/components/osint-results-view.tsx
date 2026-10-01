/**
 * Results are laid out evidence-first: what each source returned, how exact observations line up across
 * source integrations, and only then the AI's reading of it. The AI assessment is a separate, labelled
 * panel because a model's prose is an interpretation of cited evidence, not evidence; if it shared the list
 * with source records, a fluent summary could read as a stronger finding than the data behind it.
 *
 * This component only presents. Every number comes from `osint-results-model` (derived from observations
 * and source statuses), confidence is shown exactly as received (never raised or recalculated here), and a
 * failed, skipped, or empty source is rendered as a source status, never as "nothing found".
 */
import { AlertTriangle, Ban, Check, ChevronDown, ChevronRight, Loader, Search as SearchIcon } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import type { Observation, SearchRunResult, SearchSeed, SourceStatus } from "../../shared/types/search";
import "../osint-results.css";
import { OsintResultsTree } from "./osint-results-tree-view";
import type { SourceLifecycle } from "./osint-results-tree";
import { useArrivalMotion, type MotionPolicy } from "./use-arrival-motion";
import {
  bandLabel,
  buildFacts,
  buildSourceRows,
  computeTotals,
  factKey,
  filterFacts,
  runDurationLabel,
  shorten,
  type EvidenceFact,
  type EvidenceFilter,
  type SourceRow
} from "./osint-results-model";

export type OsintRunPhase = "idle" | "running" | "complete";

export interface OsintAssessment {
  readonly agentName: string;
  readonly title: string;
  readonly summary: string;
  readonly sources: readonly string[];
  /** Shown exactly as the agent run reported it. */
  readonly confidence: number;
  /** What the assessment was requested for (the selection when it was sent), so it is not mistaken for a verdict on the current selection. */
  readonly about?: string;
}

export interface OsintResultsProps {
  readonly seed: SearchSeed;
  readonly run: SearchRunResult | null;
  readonly phase: OsintRunPhase;
  readonly effort: string;
  readonly statuses: readonly SourceStatus[];
  readonly observations: readonly Observation[];
  readonly selectedObservationId: string | null;
  readonly onSelectObservation: (observationId: string) => void;
  readonly assessment?: OsintAssessment | null;
  /** Existing actions (save, send to agent, pivot) are supplied by the Search view; this component only places them. */
  readonly detailActions?: ReactNode;
  /** Marks the whole surface as synthetic. Required for fixtures so demo data can never pass as a lookup result. */
  readonly demoLabel?: string;
  /**
   * The active run's id. Animation bookkeeping is scoped to it: a different key starts a silent baseline, so one run's
   * pings can never land on the next. Omit for a saved or historical result.
   */
  readonly runKey?: string | null;
  /** Whether arrivals may animate. Defaults to `phase === "running"`; pass false for a saved case so reopening it never pretends to be live. */
  readonly live?: boolean;
  /** Per-source lifecycle, supplied only when the backend really reports it (see planning/OSINT-GRAPH-EVENT-CONTRACT.md). */
  readonly sourceActivity?: ReadonlyMap<string, SourceLifecycle>;
  /** "reduced" forces static rendering (the in-app switch and prefers-reduced-motion are always honoured as well). */
  readonly motionPolicy?: MotionPolicy;
}

const PAGE_SIZE = 50;
/** Below this width of the results container the detail opens under its row instead of in a side column. */
const SIDE_DETAIL_FROM = 900;

const FILTERS: readonly { readonly id: EvidenceFilter; readonly label: string }[] = [
  { id: "all", label: "All" },
  { id: "corroborated", label: "Cross-referenced" },
  { id: "single", label: "Single source" }
];

function formatTs(ts: string | null | undefined): string | null {
  if (!ts) {
    return null;
  }
  const parsed = new Date(ts);
  return Number.isNaN(parsed.getTime()) ? ts : `${parsed.toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

function rawText(raw: Record<string, unknown> | undefined): string | null {
  if (!raw || Object.keys(raw).length === 0) {
    return null;
  }
  try {
    const text = JSON.stringify(raw, null, 2);
    return text.length > 4000 ? `${text.slice(0, 4000)}\n… (truncated)` : text;
  } catch {
    return null;
  }
}

function rawString(observation: Observation, key: string): string | null {
  const value = observation.raw?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function OsintResultsView(props: OsintResultsProps) {
  const { seed, run, phase, effort, statuses, observations, selectedObservationId, onSelectObservation, assessment, detailActions, demoLabel, runKey, live, sourceActivity, motionPolicy } = props;
  const [filter, setFilter] = useState<EvidenceFilter>("all");
  const [text, setText] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const searchId = useId();
  const rootRef = useRef<HTMLElement | null>(null);
  const [inline, setInline] = useState(false);
  const pickedFromMap = useRef(false);

  useEffect(() => {
    const element = rootRef.current;
    if (!element) {
      return undefined;
    }
    const measure = (): void => {
      const width = element.clientWidth;
      if (width > 0) {
        setInline(width <= SIDE_DETAIL_FROM);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const facts = useMemo(() => buildFacts(observations), [observations]);
  const rows = useMemo(() => buildSourceRows(statuses, observations), [statuses, observations]);
  const totals = useMemo(() => computeTotals(observations, facts, rows), [observations, facts, rows]);
  const motion = useArrivalMotion({ runKey: runKey ?? null, facts, rows, live: live ?? phase === "running", policy: motionPolicy });
  const evidenceRef = useRef<HTMLElement | null>(null);
  const labels = useMemo(() => new Map(rows.map((row) => [row.sourceId, row.label])), [rows]);
  const selectedFact = useMemo(() => {
    const observation = observations.find((candidate) => candidate.id === selectedObservationId);
    const key = observation ? factKey(observation) : null;
    return facts.find((fact) => fact.key === key) ?? null;
  }, [facts, observations, selectedObservationId]);
  const shown = useMemo(() => filterFacts(facts, { filter, text, sourceId: sourceFilter }, labels), [facts, filter, text, sourceFilter, labels]);
  // The selected row is always in the page, so choosing a fact on the map never selects something the list hides below "Show more".
  const selectedIndex = selectedFact ? shown.findIndex((fact) => fact.key === selectedFact.key) : -1;
  const page = shown.slice(0, Math.max(PAGE_SIZE, visible, selectedIndex + 1));
  const empty = phase === "idle" && observations.length === 0 && rows.length === 0;
  const labelOf = (sourceId: string): string => labels.get(sourceId) ?? sourceId;
  const hiddenSelection = selectedFact !== null && !shown.some((fact) => fact.key === selectedFact.key);
  const detail = (isInline: boolean): ReactNode => (
    <EvidenceDetail
      fact={selectedFact}
      labelOf={labelOf}
      run={run}
      actions={detailActions}
      hiddenByFilters={hiddenSelection}
      selectedObservationId={selectedObservationId}
      onSelectObservation={onSelectObservation}
      inline={isInline}
    />
  );

  useEffect(() => {
    if (!pickedFromMap.current || !selectedObservationId) {
      return;
    }
    pickedFromMap.current = false;
    if (!inline) {
      return;
    }
    // On a narrow container the detail sits under its row, far from the map the person just tapped; bring it to them.
    const target = rootRef.current?.querySelector(".osr-detail");
    const scroll = target ? (Reflect.get(target, "scrollIntoView") as unknown) : null;
    if (target && typeof scroll === "function") {
      scroll.call(target, { block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  }, [selectedObservationId, inline]);

  // "+N more facts" and "Show all" go to the complete evidence list: move there and put focus on its heading.
  const showAllFacts = (): void => {
    const section = evidenceRef.current;
    if (!section) {
      return;
    }
    const heading = section.querySelector<HTMLElement>("#osr-evidence-title");
    const scroll = Reflect.get(section, "scrollIntoView") as unknown;
    if (typeof scroll === "function") {
      scroll.call(section, { block: "start", behavior: motion.motionOn ? "smooth" : "auto" });
    }
    heading?.focus({ preventScroll: true });
  };

  const selectFromMap = (fact: EvidenceFact): void => {
    pickedFromMap.current = true;
    selectFact(fact);
  };

  const selectFact = (fact: EvidenceFact): void => {
    // A fact is constructed from one or more observations; this is the canonical representative.
    onSelectObservation(fact.observations[0].id);
  };

  const announce =
    rows.length === 0
      ? ""
      : `${totals.returnedSources} of ${totals.totalSources} sources reported${totals.failedSources > 0 ? `; ${totals.failedSources} failed` : ""}${totals.cancelledSources > 0 ? `; ${totals.cancelledSources} cancelled` : ""}${totals.partialSources > 0 ? `; ${totals.partialSources} partial` : ""}${totals.skippedSources > 0 ? `; ${totals.skippedSources} skipped` : ""}.`;
  const hasIncompleteSources = totals.failedSources > 0 || totals.partialSources > 0 || totals.cancelledSources > 0;
  const completionDetails = [
    totals.failedSources > 0 ? `${totals.failedSources} failed` : "",
    totals.cancelledSources > 0 ? `${totals.cancelledSources} cancelled` : "",
    totals.partialSources > 0 ? `${totals.partialSources} partial` : "",
    totals.skippedSources > 0 ? `${totals.skippedSources} skipped` : ""
  ].filter(Boolean).join(" · ");
  const otherDetails = [
    totals.failedSources > 0 ? `${totals.failedSources} failed` : "",
    totals.partialSources > 0 ? `${totals.partialSources} partial` : "",
    totals.skippedSources > 0 ? `${totals.skippedSources} skipped` : ""
  ].filter(Boolean).join(" · ");
  const statePill =
    phase === "running"
      ? { tone: "running", text: "Running" }
      : phase === "complete" && totals.cancelledSources > 0
        ? // a stopped run is not a complete one, even when the stop arrives as a result
          { tone: "partial", text: `Cancelled · partial results${otherDetails ? ` · ${otherDetails}` : ""}` }
        : phase === "complete"
          ? { tone: hasIncompleteSources ? "partial" : "complete", text: completionDetails ? `Complete · ${completionDetails}` : "Complete" }
        : { tone: "idle", text: "Not started" };
  const duration = runDurationLabel(run?.startedTs ?? null, run?.completedTs ?? null);

  const treePanel = (
    <OsintResultsTree
        seed={seed}
        rows={rows}
        facts={facts}
        observations={observations}
        selectedFactKey={selectedFact?.key ?? null}
        onSelectFact={selectFromMap}
        onShowAll={showAllFacts}
        running={phase === "running"}
        motion={motion}
        sourceActivity={sourceActivity}
      />
  );

  return (
    <section className="osr" aria-labelledby="osr-title" ref={rootRef} data-motion={motion.motionOn ? "on" : "off"}>
      <header className="osr-head">
        <div>
          <p className="osr-eyebrow">Investigation results</p>
            <h2 className="osr-title" id="osr-title">
              Investigation output
          </h2>
          <p className="osr-sub">Fetched evidence and discovery links are labeled separately and link back to their source.</p>
          {demoLabel ? (
            <span className="osr-demo-tag">
              <span className="osr-demo-dot" aria-hidden="true" />
              {demoLabel}
            </span>
          ) : null}
        </div>
      </header>

      <div className="osr-run" role="group" aria-label="Investigation status">
        <div className="osr-run-left">
          <span className="osr-run-label">Seed</span>
          <span className="osr-seed">
            {seed.type} · {seed.value || "—"}
          </span>
          <span className={`osr-pill osr-pill-${statePill.tone}`}>
            {phase === "running" ? <Loader size={13} className="osr-spin" aria-hidden="true" /> : phase === "complete" ? <Check size={13} aria-hidden="true" /> : null}
            {statePill.text}
          </span>
        </div>
        <div className="osr-run-meta">
          <span className="osr-pill">{effort}</span>
          <span className="osr-run-label">
            {run ? `Started ${formatTs(run.startedTs) ?? "—"}` : phase === "running" ? "Waiting for sources" : "No run yet"}
            {duration ? ` · ${duration}` : ""}
          </span>
        </div>
      </div>
      <p className="osr-sr-only" role="status" aria-live="polite">
        {announce}
      </p>
      <p className="osr-sr-only" role="status" aria-live="polite">
        {selectedFact ? `Selected ${selectedFact.type} ${shorten(selectedFact.value, 60)}. ${bandLabel(selectedFact.band, selectedFact.upstreamFamilyIds.length, selectedFact.kind)}.` : ""}
      </p>
      {hasIncompleteSources ? (
        <p className="osr-banner" role="note">
          <AlertTriangle size={15} aria-hidden="true" />
          <span>
            {totals.failedSources > 0 ? `${totals.failedSources} of ${totals.totalSources} sources did not return. ` : ""}
            {totals.cancelledSources > 0 ? `${totals.cancelledSources} source${totals.cancelledSources === 1 ? " was" : "s were"} cancelled before finishing. ` : ""}
            {totals.partialSources > 0 ? `${totals.partialSources} source${totals.partialSources === 1 ? " has" : "s have"} incomplete results. ` : ""}
            Evidence from other sources is kept below. A failed or partial source is not evidence that the seed is absent or safe.
          </span>
        </p>
      ) : null}

      {empty ? (
        // idle: just the root and an instruction; no branches, no motion, nothing invented
        treePanel
      ) : (
        <>
          <section className="osr-totals" aria-label="Evidence totals">
            <Metric label="Observations" value={totals.observations} note={`across ${totals.sourcesWithEvidence} source${totals.sourcesWithEvidence === 1 ? "" : "s"}`} />
            <Metric label="Unique facts" value={totals.uniqueFacts} note="exact entity, type and value" />
            <Metric label="Cross-referenced" value={totals.corroboratedFacts} note="same fact, 2+ declared upstream families" />
            <Metric label="Not returned" value={totals.failedSources + totals.cancelledSources + totals.skippedSources} note={`${totals.failedSources} failed${totals.cancelledSources > 0 ? ` · ${totals.cancelledSources} cancelled` : ""} · ${totals.skippedSources} skipped`} />
          </section>

          <div className="osr-grid">
            {treePanel}
            <div className="osr-stack">
              <SourceActivity rows={rows} />
              <Assessment assessment={assessment ?? null} observations={observations} onSelectObservation={onSelectObservation} />
            </div>
          </div>

          <section className="osr-panel osr-evidence" aria-labelledby="osr-evidence-title" ref={evidenceRef}>
            <div className="osr-panel-head">
              <div>
                <h2 className="osr-panel-title" id="osr-evidence-title" tabIndex={-1}>
                  Evidence
                </h2>
                <p className="osr-panel-sub">Source-returned results stay primary. Discovery links are not supporting evidence.</p>
              </div>
              <div className="osr-controls">
                <div className="osr-filter-set" role="group" aria-label="Filter evidence">
                  {FILTERS.map((item) => (
                    <button key={item.id} className="osr-filter" type="button" aria-pressed={filter === item.id} onClick={() => { setFilter(item.id); setVisible(PAGE_SIZE); }}>
                      {item.label}
                    </button>
                  ))}
                </div>
                <label className="osr-search" htmlFor={searchId}>
                  <span className="osr-sr-only">Filter evidence text</span>
                  <SearchIcon size={15} aria-hidden="true" />
                  <input id={searchId} type="search" value={text} placeholder="Filter evidence…" autoComplete="off" onChange={(event) => { setText(event.target.value); setVisible(PAGE_SIZE); }} />
                </label>
              </div>
            </div>
            {rows.length > 1 ? (
              <div className="osr-source-filter" role="group" aria-label="Filter by source">
                {rows.map((row) => (
                  <button
                    key={row.sourceId}
                    className="osr-chip-button"
                    type="button"
                    aria-pressed={sourceFilter === row.sourceId}
                    onClick={() => { setSourceFilter((current) => (current === row.sourceId ? null : row.sourceId)); setVisible(PAGE_SIZE); }}
                  >
                    {row.label}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="osr-evidence-body">
              <div className="osr-list-wrap">
                {inline && hiddenSelection ? detail(true) : null}
                <p className="osr-count">
                  Showing {page.length} of {shown.length} fact{shown.length === 1 ? "" : "s"}
                  {shown.length === facts.length ? "" : ` matching the filters (${facts.length} in total)`}
                </p>
                <ul className="osr-list" aria-label="Evidence facts">
                  {page.map((fact) => {
                    const selected = selectedFact?.key === fact.key;
                    return (
                      <li key={fact.key}>
                        <button className={`osr-row${selected ? " is-selected" : ""}`} type="button" aria-pressed={selected} onClick={() => selectFact(fact)}>
                          <span className="osr-row-main">
                            <strong>{fact.type}</strong>
                            <small>{fact.entity}</small>
                          </span>
                          <span className="osr-row-value">{shorten(fact.value, 400)}</span>
                          <span className="osr-chips">
                            {fact.sourceIds.map((sourceId) => (
                              <span className="osr-chip" key={sourceId}>
                                {labelOf(sourceId)}
                              </span>
                            ))}
                          </span>
                          <span className={`osr-strength${fact.corroborated ? " is-corroborated" : ""}`}>{bandLabel(fact.band, fact.upstreamFamilyIds.length, fact.kind)}</span>
                          <ChevronRight size={16} className="osr-chevron" aria-hidden="true" />
                        </button>
                        {inline && selected ? detail(true) : null}
                      </li>
                    );
                  })}
                </ul>
                {shown.length === 0 ? (
                  <p className="osr-empty">{facts.length === 0 ? "No observations have been returned yet." : "No evidence matches the current filters."}</p>
                ) : null}
                {shown.length > page.length ? (
                  <button className="osr-btn osr-more" type="button" onClick={() => setVisible(page.length + PAGE_SIZE)}>
                    Show {Math.min(PAGE_SIZE, shown.length - page.length)} more
                  </button>
                ) : null}
              </div>
              {inline ? null : detail(false)}
            </div>
          </section>
        </>
      )}
    </section>
  );
}

function Metric(props: { readonly label: string; readonly value: number; readonly note: string }) {
  return (
    <article className="osr-metric">
      <div className="osr-metric-label">{props.label}</div>
      <div className="osr-metric-value">
        {props.value}
        <span className="osr-metric-note">{props.note}</span>
      </div>
    </article>
  );
}

function SourceActivity(props: { readonly rows: readonly SourceRow[] }) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const baseId = useId();
  const toggle = (sourceId: string): void =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(sourceId)) {
        next.add(sourceId);
      }
      return next;
    });
  return (
    <section className="osr-panel" aria-labelledby="osr-sources-title">
      <div className="osr-panel-head">
        <div>
          <h2 className="osr-panel-title" id="osr-sources-title">
            Source activity
          </h2>
          <p className="osr-panel-sub">Connector status and returned records</p>
        </div>
        <span className="osr-pill">{props.rows.length} total</span>
      </div>
      <ul className="osr-sources">
        {props.rows.map((row, index) => {
          const expanded = open.has(row.sourceId);
          const panelId = `${baseId}-source-${index}`;
          return (
            <li className={`osr-source osr-source-${row.state}`} key={row.sourceId}>
              <div className="osr-source-name">
                <strong>{row.label}</strong>
                <span>{row.summary}</span>
              </div>
              <span className={`osr-source-state osr-source-state-${row.state}${row.warning ? " is-partial" : ""}`}>
                {row.state === "failed" || row.warning ? <AlertTriangle size={13} aria-hidden="true" /> : row.state === "skipped" ? <Ban size={13} aria-hidden="true" /> : row.state === "returned" ? <Check size={13} aria-hidden="true" /> : <Loader size={13} aria-hidden="true" />}
                {row.stateLabel}
              </span>
              <span className="osr-source-count" aria-label={row.count === null ? "No count" : `${row.count} observations`}>
                {row.count ?? "—"}
              </span>
              <button className="osr-btn osr-btn-icon" type="button" aria-expanded={expanded} aria-controls={panelId} aria-label={`${expanded ? "Collapse" : "Expand"} ${row.label} details`} onClick={() => toggle(row.sourceId)}>
                {expanded ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
              </button>
              {expanded ? (
                <div className="osr-source-detail" id={panelId}>
                  <p>{row.detail}</p>
                  <p className="osr-mono">source id · {row.sourceId}</p>
                  {row.policy ? (
                    <dl className="osr-source-policy">
                      <div><dt>Access</dt><dd>{row.policy.accessMode} · {row.policy.jurisdiction}</dd></div>
                      <div><dt>Coverage / limits</dt><dd>{row.policy.coverage}</dd></div>
                      <div><dt>Freshness</dt><dd>{row.policy.freshness}</dd></div>
                      <div><dt>Request budget</dt><dd>{row.policy.localRequestBudget}{row.policy.documentedQuota ? ` · documented: ${row.policy.documentedQuota}` : " · provider quota not documented"}</dd></div>
                      <div><dt>Official access / terms reference</dt><dd className="osr-mono">{row.policy.termsUrl}</dd></div>
                    </dl>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {props.rows.length === 0 ? <p className="osr-empty">Sources appear as they return.</p> : null}
      <p className="osr-note">Status uses text and symbols as well as color. A failed source never erases evidence the others returned.</p>
    </section>
  );
}

function Assessment(props: {
  readonly assessment: OsintAssessment | null;
  readonly observations: readonly Observation[];
  readonly onSelectObservation: (observationId: string) => void;
}) {
  const { assessment, observations, onSelectObservation } = props;
  const known = new Set(observations.map((observation) => observation.id));
  return (
    <section className="osr-panel osr-assessment" aria-labelledby="osr-assessment-title">
      <div className="osr-panel-head">
        <div>
          <h2 className="osr-panel-title" id="osr-assessment-title">
            AI assessment
          </h2>
          <p className="osr-panel-sub">Separate interpretation · inspect the citations</p>
        </div>
        {assessment ? <span className="osr-pill">{assessment.agentName}</span> : null}
      </div>
      {assessment ? (
        <div className="osr-assessment-body">
          <div className="osr-assessment-label">
            <span className="osr-interpretation">Interpretation</span>
            <span className="osr-confidence" title="Confidence exactly as the agent run reported it; it is not recalculated here.">
              Confidence as reported · {assessment.confidence}
            </span>
          </div>
          {assessment.about ? <p className="osr-assessment-about">Requested for · {assessment.about}</p> : null}
          <h3 className="osr-assessment-title">{assessment.title}</h3>
          <p>{assessment.summary}</p>
          <p className="osr-note osr-note-flush">This is an interpretation of the cited records, not a source result. It does not raise any fact above the grade its sources support.</p>
          <div className="osr-citations" role="group" aria-label="Cited records">
            {assessment.sources.map((source) =>
              known.has(source) ? (
                <button key={source} className="osr-citation osr-citation-link" type="button" onClick={() => onSelectObservation(source)}>
                  {source}
                </button>
              ) : (
                <span key={source} className="osr-citation">
                  {source}
                </span>
              )
            )}
          </div>
        </div>
      ) : (
        <p className="osr-empty">No AI assessment for this run. Select evidence and use Send to agent to request one.</p>
      )}
    </section>
  );
}

function EvidenceDetail(props: {
  readonly fact: EvidenceFact | null;
  readonly labelOf: (sourceId: string) => string;
  readonly run: SearchRunResult | null;
  readonly actions: ReactNode;
  readonly hiddenByFilters: boolean;
  readonly selectedObservationId: string | null;
  readonly onSelectObservation: (observationId: string) => void;
  readonly inline: boolean;
}) {
  const { fact, labelOf, run, actions, hiddenByFilters, selectedObservationId, onSelectObservation, inline } = props;
  // Not a live region: it holds ~450 characters and would re-read in full on every selection (and on every arrow key in the
  // map). The short announcement of what was selected lives in the results header's status line instead.
  return (
    <section className={`osr-detail${inline ? " osr-detail-inline" : ""}`} aria-label="Selected evidence">
      <h3 className="osr-detail-title">Selected evidence</h3>
      {fact ? (
        <>
          <div className="osr-detail-top">
            <strong>{fact.type}</strong>
            <span className={`osr-strength${fact.corroborated ? " is-corroborated" : ""}`}>{bandLabel(fact.band, fact.upstreamFamilyIds.length, fact.kind)}</span>
          </div>
          {hiddenByFilters ? <p className="osr-note osr-note-flush">This item is hidden from the list by the current filters.</p> : null}
          <p className="osr-detail-copy">
            {fact.kind === "discovery"
              ? "This is a directory or discovery link, not a fetched record about the subject. Opening it is a separate action; it does not support or corroborate a claim."
              : fact.corroborated
                ? `${fact.upstreamFamilyIds.length} declared upstream families returned this exact ${fact.type}; integrations: ${fact.sourceIds.join(", ")}. Family declarations are recorded for comparison, not independently audited.`
                : fact.upstreamFamilyIds.length === 0
                  ? "No upstream family is known for this record, so it cannot count as independent corroboration. Treat it as a lead."
                  : "Only one declared upstream family returned this fact. Treat it as a lead until another independent family agrees."}
          </p>
          <dl className="osr-facts">
            <div>
              <dt>Entity</dt>
              <dd>{fact.entity}</dd>
            </div>
            <div>
              <dt>Observed value</dt>
              <dd className="osr-mono">{shorten(fact.value, 2000)}</dd>
            </div>
            <div>
              <dt>Run completed</dt>
              <dd className="osr-mono">{formatTs(run?.completedTs) ?? "Not available until the run finishes"}</dd>
            </div>
          </dl>
          <h4 className="osr-detail-sub">Provenance</h4>
          <ul className="osr-provenance">
            {fact.observations.map((observation, index) => {
              const raw = rawText(observation.raw);
              const url = observation.recordUrl ?? rawString(observation, "sourceUrl");
              const current = observation.id === selectedObservationId;
              return (
                <li key={`${observation.id}:${index}`} className={current ? "is-current" : undefined}>
                  <div className="osr-prov-head">
                    <strong>{labelOf(observation.source)}</strong>
                    <span className="osr-mono">{observation.id}</span>
                  </div>
                  <dl className="osr-prov-meta">
                    <div><dt>Provider / publisher</dt><dd>{observation.publisherId ?? "Not identified"}</dd></div>
                    <div><dt>Upstream family</dt><dd>{observation.upstreamFamilyId ?? "Unknown; not counted as independent"}</dd></div>
                    <div><dt>Record / lookup URL</dt><dd className="osr-mono">{url ?? "Not returned"}</dd></div>
                    {observation.rawValue !== undefined ? <div><dt>Raw value</dt><dd className="osr-mono">{shorten(observation.rawValue, 1000)}</dd></div> : null}
                  </dl>
                  {fact.observations.length > 1 ? (
                    current ? (
                      <p className="osr-prov-current">Selected record · actions below use this one</p>
                    ) : (
                      <button className="osr-btn osr-prov-pick" type="button" aria-label={`Use the ${labelOf(observation.source)} record ${observation.id}`} onClick={() => onSelectObservation(observation.id)}>
                        Use this record
                      </button>
                    )
                  ) : null}
                  {raw ? (
                    <details>
                      <summary>Raw source detail</summary>
                      <pre>{raw}</pre>
                    </details>
                  ) : (
                    <p className="osr-note osr-note-flush">No raw detail was returned for this record.</p>
                  )}
                </li>
              );
            })}
          </ul>
          {actions ? <div className="osr-actions">{actions}</div> : null}
        </>
      ) : (
        <p className="osr-empty">Select evidence to inspect its source, value and provenance.</p>
      )}
    </section>
  );
}
