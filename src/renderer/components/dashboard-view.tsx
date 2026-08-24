/**
 * Dashboard hosts the watchlist because exposure alerts are something Jack
 * needs at launch, not buried in a separate workflow. If monitoring lived only
 * behind a hidden IPC surface, scheduled findings would be easy to miss.
 *
 * The layout is a monitoring wall: a recent-activity feed, an agent fleet gauge
 * (donut + per-agent load), and a watchlist-alert age breakdown sit above the
 * watchlist controls and the exposure tables. Every number is derived from the
 * same summary/watch/exposure read model so nothing on the wall can drift from
 * the audited state behind it.
 */
import { Bot, ExternalLink, Eye, Globe, Mail, Phone, Plus, RefreshCw, Search, ShieldAlert, Trash2, User } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import type { AgentLiveState, AgentRunRecord } from "../../shared/schemas/agents-runtime";
import type { DashboardSummaryResponse } from "../../shared/schemas/dashboard";
import type { CaseRecord } from "../../shared/schemas/cases";
import type { ExposureRecord, MonitoringAlert, WatchRecord } from "../../shared/schemas/monitoring";
import type { WatchTargetType } from "../../shared/types/monitoring";
import { useReacherClient } from "../hooks/use-reacher-client";

export function DashboardView() {
  const { invoke } = useReacherClient();
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [watches, setWatches] = useState<WatchRecord[]>([]);
  const [alerts, setAlerts] = useState<MonitoringAlert[]>([]);
  const [exposures, setExposures] = useState<ExposureRecord[]>([]);
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [type, setType] = useState<WatchTargetType>("email");
  const [value, setValue] = useState("security@example.com");
  const [caseId, setCaseId] = useState("");
  const [showWatchForm, setShowWatchForm] = useState(false);
  const [status, setStatus] = useState("Monitoring ready");
  const [loadingLabel, setLoadingLabel] = useState("Loading dashboard");
  const [reachability, setReachability] = useState<Record<string, boolean | null>>({});

  /**
   * Fired without awaiting so a slow or unreachable site never delays the
   * rest of the dashboard load -- each row's light updates independently as
   * its own check resolves. Only domain watches have a "site" to reach.
   */
  const checkReachability = useCallback((list: readonly WatchRecord[]): void => {
    for (const watch of list.filter((entry) => entry.type === "domain")) {
      invoke("watch:reachability", { watchId: watch.id })
        .then((result) => {
          if (result.ok) {
            setReachability((current) => ({ ...current, [watch.id]: result.value.online }));
          }
        })
        .catch(() => {
          // A closed/reloaded window can reject an in-flight invoke; the light
          // just stays "checking" rather than crashing the dashboard over it.
        });
    }
  }, [invoke]);

  const refresh = useCallback(async () => {
    setLoadingLabel("Loading dashboard");
    const [summaryResult, watchResult, exposureResult, casesResult] = await Promise.all([
      invoke("dashboard:summary", {}),
      invoke("watch:list", {}),
      invoke("watch:exposures", {}),
      invoke("cases:list", {})
    ]);
    if (summaryResult.ok) {
      setSummary(summaryResult.value);
    }
    if (watchResult.ok) {
      setWatches(watchResult.value.watches);
      setAlerts(watchResult.value.alerts);
      checkReachability(watchResult.value.watches);
    }
    if (exposureResult.ok) {
      setExposures(exposureResult.value.exposures);
    }
    if (casesResult.ok) {
      setCases(casesResult.value.cases);
      setCaseId((current) => current || casesResult.value.cases[0]?.id || "");
    }
    setLoadingLabel("");
  }, [invoke, checkReachability]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [refresh]);

  async function addWatch() {
    setLoadingLabel("Adding watch target");
    const result = await invoke("watch:add", {
      type,
      value,
      caseId: caseId || undefined,
      checkIntervalMinutes: 60
    });
    if (!result.ok) {
      setStatus(result.error.message);
      setLoadingLabel("");
      return;
    }
    setStatus(`Watching ${result.value.watch.value}`);
    setShowWatchForm(false);
    await refresh();
  }

  async function checkNow(watch: WatchRecord) {
    setLoadingLabel(`Checking ${watch.value}`);
    setStatus(`Checking ${watch.value}`);
    const result = await invoke("watch:checkNow", { watchId: watch.id, caseId: (watch.caseId ?? caseId) || undefined });
    if (!result.ok) {
      setStatus(result.error.message);
      setLoadingLabel("");
      return;
    }
    setStatus(
      result.value.newExposures.length > 0
        ? `${result.value.newExposures.length} new exposures saved:${result.value.savedItems}`
        : `No new exposures; skipped:${result.value.skippedSources.length}`
    );
    await refresh();
  }

  async function removeWatch(watch: WatchRecord) {
    setLoadingLabel(`Removing ${watch.value}`);
    const result = await invoke("watch:remove", { watchId: watch.id });
    setStatus(result.ok && result.value.removed ? "Watch removed" : "Watch was not removed");
    await refresh();
  }

  const agentStates = summary?.agentStatus.states ?? [];
  const fleetTotal = agentStates.length;
  const workingCount = summary?.agentStatus.working ?? 0;
  const fleetUsagePct = fleetTotal > 0 ? Math.round((workingCount / fleetTotal) * 100) : 0;
  const usageRows = agentUsage(agentStates, summary?.recentAgentRuns ?? []);
  const ageBuckets = alertAgeBuckets(alerts);
  const activity = buildActivity(summary);

  return (
    <section className="route-surface" aria-labelledby="dashboard-title">
      <header className="route-header">
        <h1 className="route-title" id="dashboard-title">
          Dashboard
        </h1>
        <p className="route-summary">Track exposure alerts, agent fleet status, and quick checks from the local watchlist.</p>
      </header>

      <div className="dashboard-wall">
        <section className="console-panel dashboard-card" aria-labelledby="recent-activity-title">
          <h2 className="section-title" id="recent-activity-title">Recent activity</h2>
          <div className="dashboard-activity-list">
            {activity.map((item) => (
              <div className={item.highlight ? "dashboard-activity-row is-highlight" : "dashboard-activity-row"} key={item.id}>
                <span className="dashboard-activity-icon" aria-hidden="true">{item.icon}</span>
                <div className="dashboard-activity-body">
                  <strong>{item.title}</strong>
                  <span className="status-text">{item.meta}</span>
                </div>
              </div>
            ))}
            {activity.length === 0 ? <p className="status-text">No recent searches or agent runs.</p> : null}
          </div>
        </section>

        <section className="console-panel dashboard-card" aria-labelledby="fleet-monitor-title">
          <div className="section-title-row section-title-row-wide">
            <h2 className="section-title" id="fleet-monitor-title">Agent fleet monitor &amp; usage</h2>
            <span className="status-text">Fleet: {fleetTotal}</span>
          </div>
          <div className="fleet-monitor-body">
            <FleetDonut pct={fleetUsagePct} />
            <div className="fleet-agent-list">
              {usageRows.map((row) => (
                <div className="fleet-agent-row" key={row.agentId}>
                  <span className={`status-dot ${agentLightClass(row.status)}`} aria-hidden="true" />
                  <div className="fleet-agent-identity">
                    <strong>{row.agentId}</strong>
                    <span className="status-text">{row.status === "working" ? "Active" : row.status === "idle" ? "Idling" : row.status}</span>
                  </div>
                  <span className="fleet-usage-track" title={`${row.pct}% load`}>
                    <span className={`fleet-usage-fill ${row.status}`} style={{ "--usage": `${row.pct}%` } as CSSProperties} />
                  </span>
                  <span className="fleet-usage-pct">{row.status === "working" ? `${row.pct}%` : "Idling"}</span>
                </div>
              ))}
              {usageRows.length === 0 ? <p className="status-text">No agents reporting yet.</p> : null}
            </div>
          </div>
        </section>

        <section className="console-panel dashboard-card" aria-labelledby="alert-age-title">
          <div className="section-title-row section-title-row-wide">
            <h2 className="section-title" id="alert-age-title">Watchlist alert age status</h2>
          </div>
          <div className="alert-age-body">
            <div className="alert-age-bars">
              <AgeBar label="New (<1w)" count={ageBuckets.fresh} total={ageBuckets.total} tone="fresh" />
              <AgeBar label="Aging (1w+)" count={ageBuckets.aging} total={ageBuckets.total} tone="aging" />
              <AgeBar label="Addressed" count={ageBuckets.addressed} total={ageBuckets.total} tone="addressed" />
            </div>
            <div className="alert-age-total">
              <strong>{ageBuckets.total}</strong>
              <span className="status-text">Total alerts</span>
            </div>
          </div>
        </section>

        <section className="console-panel dashboard-card" aria-labelledby="watchlist-title">
          <div className="section-title-row section-title-row-wide">
            <h2 className="section-title" id="watchlist-title">Watchlist</h2>
            <div className="dashboard-card-actions">
              <button
                className={showWatchForm ? "action-button primary-action" : "action-button"}
                type="button"
                aria-expanded={showWatchForm}
                onClick={() => setShowWatchForm((open) => !open)}
              >
                <Plus size={16} aria-hidden="true" />
                Add watch
              </button>
              <button className="icon-button" type="button" aria-label="Refresh monitoring" onClick={() => void refresh()}>
                <RefreshCw size={16} />
              </button>
            </div>
          </div>
          {showWatchForm ? (
            <div className="dashboard-watch-form dashboard-watch-form-open">
              <label className="compact-field">
                Type
                <select className="field-control" value={type} onChange={(event) => setType(event.target.value as WatchTargetType)}>
                  <option value="email">email</option>
                  <option value="domain">domain</option>
                </select>
              </label>
              <label className="compact-field">
                Target
                <input className="field-control" value={value} onChange={(event) => setValue(event.target.value)} />
              </label>
              <label className="compact-field">
                Case
                <select className="field-control" value={caseId} onChange={(event) => setCaseId(event.target.value)}>
                  <option value="">No case</option>
                  {cases.map((caseRecord) => (
                    <option key={caseRecord.id} value={caseRecord.id}>
                      {caseRecord.title}
                    </option>
                  ))}
                </select>
              </label>
              <button className="action-button primary-action" type="button" onClick={() => void addWatch()}>
                <Plus size={16} />
                Save watch
              </button>
            </div>
          ) : null}
          <p className="status-text">{status}</p>
          <div className="watchlist-table" role="table" aria-label="Watchlist">
            <div className="watchlist-head" role="row">
              <span role="columnheader">Type</span>
              <span role="columnheader">Target</span>
              <span role="columnheader">Last check</span>
              <span role="columnheader" className="watchlist-actions-col">Actions</span>
            </div>
            {watches.map((watch) => (
              <div key={watch.id} className="watchlist-row" role="row">
                <span className="watchlist-type" role="cell">
                  {watch.type === "domain" ? <Globe size={14} aria-hidden="true" /> : <Mail size={14} aria-hidden="true" />}
                  {watch.type}
                </span>
                <span className="watchlist-target" role="cell">
                  {watch.type === "domain" ? (
                    <span
                      className={`status-dot ${reachabilityDotClass(reachability[watch.id])}`}
                      aria-hidden="true"
                      title={reachabilityLabel(reachability[watch.id])}
                    />
                  ) : null}
                  {watch.value}
                </span>
                <span className="status-text" role="cell">{formatWhen(watch.lastCheckedTs)}</span>
                <span className="watchlist-row-actions" role="cell">
                  {watch.type === "domain" ? (
                    <a
                      className="icon-button"
                      href={`https://${watch.value}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open ${watch.value} in browser`}
                      title="View in browser"
                    >
                      <ExternalLink size={15} aria-hidden="true" />
                    </a>
                  ) : null}
                  <button className="action-button" type="button" onClick={() => void checkNow(watch)}>
                    <Eye size={15} />
                    Check now
                  </button>
                  <button className="icon-button" type="button" aria-label={`Remove ${watch.value}`} onClick={() => void removeWatch(watch)}>
                    <Trash2 size={15} />
                  </button>
                </span>
              </div>
            ))}
            {watches.length === 0 ? <p className="status-text">No watch targets yet.</p> : null}
          </div>
        </section>

        <section className="console-panel dashboard-card" aria-labelledby="exposure-alerts-title">
          <div className="section-title-row section-title-row-wide">
            <h2 className="section-title" id="exposure-alerts-title">Exposure alerts</h2>
            <ShieldAlert size={16} aria-hidden="true" />
          </div>
          <div className="dashboard-activity-list">
            {alerts.map((alert) => (
              <div key={alert.id} className="dashboard-alert-warning-row">
                <ShieldAlert size={16} aria-hidden="true" className="dashboard-alert-warning-icon" />
                <div className="dashboard-activity-body">
                  <strong>{alert.message}</strong>
                  <span className="status-text">{formatWhen(alert.createdTs)}</span>
                </div>
                <a className="icon-button" href={webSearchUrl(alert.message)} target="_blank" rel="noreferrer" aria-label="Open source" title="Open source">
                  <ExternalLink size={15} aria-hidden="true" />
                </a>
              </div>
            ))}
            {alerts.length === 0 ? <p className="status-text">No exposure alerts recorded.</p> : null}
          </div>
        </section>

        <section className="console-panel dashboard-card" aria-labelledby="exposures-title">
          <h2 className="section-title" id="exposures-title">Exposures</h2>
          <div className="exposures-table" role="table" aria-label="Exposures">
            <div className="exposures-head" role="row">
              <span role="columnheader">Source</span>
              <span role="columnheader">First seen</span>
              <span role="columnheader">Description</span>
            </div>
            {exposures.map((exposure) => (
              <div key={exposure.id} className="exposures-row" role="row">
                <span className="exposures-source" role="cell">
                  <span className="exposure-logo" aria-hidden="true">{monogram(exposure.source)}</span>
                  {exposure.source}
                </span>
                <span className="status-text" role="cell">{formatWhen(exposure.firstSeenTs)}</span>
                <span className="exposures-detail" role="cell">
                  <strong>{exposure.title}</strong>
                  <span className="status-text">{exposure.detail}</span>
                </span>
              </div>
            ))}
            {exposures.length === 0 ? <p className="status-text">No stored exposures yet.</p> : null}
          </div>
        </section>
      </div>
      {loadingLabel ? <div className="route-loading" role="status">{loadingLabel}</div> : null}
    </section>
  );
}

interface ActivityItem {
  readonly id: string;
  readonly title: string;
  readonly meta: string;
  readonly icon: ReactNode;
  readonly highlight: boolean;
}

/** Merge recent searches and agent runs into one icon-led activity feed. */
function buildActivity(summary: DashboardSummaryResponse | null): ActivityItem[] {
  if (!summary) {
    return [];
  }
  const searches: ActivityItem[] = summary.recentSearches.map((run) => ({
    id: `search-${run.id}`,
    title: run.seedValue,
    meta: `${run.seedType} / ${run.completedTs ? "complete" : "running"} | ${formatWhen(run.startedTs)}`,
    icon: seedIcon(run.seedType),
    highlight: false
  }));
  const runs: ActivityItem[] = summary.recentAgentRuns.map((run) => ({
    id: `run-${run.id}`,
    title: run.agentId,
    meta: `${run.status} / ${run.seed.type}:${run.seed.value}`,
    icon: <Bot size={16} aria-hidden="true" />,
    highlight: run.status === "succeeded"
  }));
  return [...searches, ...runs].slice(0, 12);
}

function seedIcon(seedType: string): ReactNode {
  switch (seedType) {
    case "email":
      return <Mail size={16} aria-hidden="true" />;
    case "phone":
      return <Phone size={16} aria-hidden="true" />;
    case "domain":
      return <Globe size={16} aria-hidden="true" />;
    case "username":
      return <User size={16} aria-hidden="true" />;
    default:
      return <Search size={16} aria-hidden="true" />;
  }
}

interface UsageRow {
  readonly agentId: string;
  readonly status: string;
  readonly pct: number;
}

/**
 * Per-agent load: a working agent reads high, an idle one low, and recent run
 * history nudges the bar so the busiest agent stands out. It is a derived load
 * indicator, not a CPU meter, but it is computed from real run counts.
 */
function agentUsage(states: readonly AgentLiveState[], runs: readonly AgentRunRecord[]): UsageRow[] {
  const counts = new Map<string, number>();
  for (const run of runs) {
    counts.set(run.agentId, (counts.get(run.agentId) ?? 0) + 1);
  }
  const max = Math.max(1, ...counts.values());
  return states.map((state) => {
    const runShare = (counts.get(state.agentId) ?? 0) / max;
    const base = state.status === "working" ? 0.55 : state.status === "idle" ? 0.12 : 0;
    const pct = Math.min(100, Math.round((base + runShare * 0.45) * 100));
    return { agentId: state.agentId, status: state.status, pct };
  });
}

interface AgeBuckets {
  readonly fresh: number;
  readonly aging: number;
  readonly addressed: number;
  readonly total: number;
}

function alertAgeBuckets(alerts: readonly MonitoringAlert[]): AgeBuckets {
  const now = Date.now();
  let fresh = 0;
  let aging = 0;
  let addressed = 0;
  for (const alert of alerts) {
    if (alert.acknowledgedTs) {
      addressed += 1;
      continue;
    }
    const parsed = Date.parse(alert.createdTs);
    const days = Number.isFinite(parsed) ? (now - parsed) / 86_400_000 : 0;
    if (days >= 7) {
      aging += 1;
    } else {
      fresh += 1;
    }
  }
  return { fresh, aging, addressed, total: alerts.length };
}

function AgeBar({ label, count, total, tone }: { readonly label: string; readonly count: number; readonly total: number; readonly tone: string }) {
  const share = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="age-bar-row">
      <span className={`age-bar-label age-${tone}`}>{label}</span>
      <span className="age-bar-track">
        <span className={`age-bar-fill age-${tone}`} style={{ "--share": `${share}%` } as CSSProperties} />
      </span>
      <span className="age-bar-count">{count}</span>
    </div>
  );
}

function FleetDonut({ pct }: { readonly pct: number }) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const dash = (pct / 100) * circumference;
  return (
    <svg viewBox="0 0 120 120" className="fleet-donut" role="img" aria-label={`Total fleet usage ${pct} percent`}>
      <circle cx="60" cy="60" r={radius} className="fleet-donut-track" />
      <circle
        cx="60"
        cy="60"
        r={radius}
        className="fleet-donut-value"
        strokeDasharray={`${dash} ${circumference - dash}`}
        transform="rotate(-90 60 60)"
      />
      <text x="60" y="57" className="fleet-donut-pct">{pct}%</text>
      <text x="60" y="76" className="fleet-donut-caption">fleet usage</text>
    </svg>
  );
}

function reachabilityDotClass(online: boolean | null | undefined): string {
  if (online === true) {
    return "status-dot-verified";
  }
  if (online === false) {
    return "status-dot-error";
  }
  return "status-dot-untested";
}

function reachabilityLabel(online: boolean | null | undefined): string {
  if (online === true) {
    return "Site is reachable";
  }
  if (online === false) {
    return "Site is unreachable";
  }
  return "Checking site status...";
}

function agentLightClass(status: string): string {
  if (status === "working") {
    return "status-dot-verified";
  }
  if (status === "error") {
    return "status-dot-error";
  }
  return status === "offline" ? "status-dot-untested" : "status-dot-candidate";
}

/** First letters of an exposure/company name as a stand-in logo tile. */
function monogram(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return "?";
  }
  const initials = words.length === 1 ? words[0].slice(0, 2) : `${words[0][0]}${words[1][0]}`;
  return initials.toUpperCase();
}

function formatWhen(ts: string | null): string {
  if (!ts) {
    return "never";
  }
  const parsed = Date.parse(ts);
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleString() : ts;
}

function webSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
