/**
 * Dashboard hosts the watchlist because exposure alerts are something Jack
 * needs at launch, not buried in a separate workflow. If monitoring lived only
 * behind a hidden IPC surface, scheduled findings would be easy to miss.
 */
import { Eye, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
  const [type, setType] = useState<WatchTargetType>("email");
  const [value, setValue] = useState("security@example.com");
  const [caseId, setCaseId] = useState("");
  const [status, setStatus] = useState("Monitoring ready");

  const refresh = useCallback(async () => {
    const [watchResult, exposureResult, casesResult] = await Promise.all([
      invoke("watch:list", {}),
      invoke("watch:exposures", {}),
      invoke("cases:list", {})
    ]);
    if (watchResult.ok) {
      setWatches(watchResult.value.watches);
      setAlerts(watchResult.value.alerts);
    }
    if (exposureResult.ok) {
      setExposures(exposureResult.value.exposures);
    }
    if (casesResult.ok) {
      setCases(casesResult.value.cases);
      setCaseId((current) => current || casesResult.value.cases[0]?.id || "");
    }
  }, [invoke]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [refresh]);

  async function addWatch() {
    const result = await invoke("watch:add", {
      type,
      value,
      caseId: caseId || undefined,
      checkIntervalMinutes: 60
    });
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setStatus(`Watching ${result.value.watch.value}`);
    await refresh();
  }

  async function checkNow(watch: WatchRecord) {
    setStatus(`Checking ${watch.value}`);
    const result = await invoke("watch:checkNow", { watchId: watch.id, caseId: (watch.caseId ?? caseId) || undefined });
    if (!result.ok) {
      setStatus(result.error.message);
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
    const result = await invoke("watch:remove", { watchId: watch.id });
    setStatus(result.ok && result.value.removed ? "Watch removed" : "Watch was not removed");
    await refresh();
  }

  return (
    <section className="route-surface" aria-labelledby="dashboard-title">
      <header className="route-header">
        <h1 className="route-title" id="dashboard-title">
          Dashboard
        </h1>
        <p className="route-summary">Track exposure alerts, active cases, and quick checks from the local watchlist.</p>
      </header>

      <div className="dashboard-layout">
        <section className="console-panel dashboard-panel">
          <div className="section-title-row">
            <h2 className="section-title">Watchlist</h2>
            <button className="icon-button" type="button" aria-label="Refresh monitoring" onClick={() => void refresh()}>
              <RefreshCw size={18} />
            </button>
          </div>
          <div className="dashboard-watch-form">
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
            <button className="action-button" type="button" onClick={() => void addWatch()}>
              <Plus size={18} />
              Add watch
            </button>
          </div>
          <p className="status-text">{status}</p>
          <div className="table-list">
            {watches.map((watch) => (
              <div key={watch.id} className="dashboard-watch-row">
                <div>
                  <strong>{watch.value}</strong>
                  <span className="status-text">
                    {watch.type} / interval:{watch.checkIntervalMinutes}m / last:{watch.lastCheckedTs ?? "never"}
                  </span>
                </div>
                <button className="action-button" type="button" onClick={() => void checkNow(watch)}>
                  <Eye size={18} />
                  Check now
                </button>
                <button className="icon-button" type="button" aria-label={`Remove ${watch.value}`} onClick={() => void removeWatch(watch)}>
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            {watches.length === 0 ? <p className="status-text">No watch targets yet.</p> : null}
          </div>
        </section>

        <section className="console-panel dashboard-panel">
          <h2 className="section-title">Exposure alerts</h2>
          <div className="table-list">
            {alerts.map((alert) => (
              <div key={alert.id} className="dashboard-alert-row">
                <strong>{alert.message}</strong>
                <span className="status-text">{alert.createdTs}</span>
              </div>
            ))}
            {alerts.length === 0 ? <p className="status-text">No exposure alerts recorded.</p> : null}
          </div>
        </section>

        <section className="console-panel dashboard-panel">
          <h2 className="section-title">Exposures</h2>
          <div className="table-list">
            {exposures.map((exposure) => (
              <div key={exposure.id} className="dashboard-alert-row">
                <strong>{exposure.title}</strong>
                <span className="status-text">
                  {exposure.source} / first:{exposure.firstSeenTs}
                </span>
                <span className="status-text">{exposure.detail}</span>
              </div>
            ))}
            {exposures.length === 0 ? <p className="status-text">No stored exposures yet.</p> : null}
          </div>
        </section>
      </div>
    </section>
  );
}
