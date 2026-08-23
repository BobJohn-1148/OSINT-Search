/**
 * AuditLogView exposes append-only history through filters instead of direct
 * table browsing. If the renderer shaped these queries itself, sensitive review
 * could silently diverge from the main-process audit contract.
 */
import { Filter, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { AuditEvent, AuditSensitivity } from "../../shared/schemas/audit";
import { auditSensitivityValues } from "../../shared/schemas/audit";
import { useReacherClient } from "../hooks/use-reacher-client";

export function AuditLogView() {
  const { invoke } = useReacherClient();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [action, setAction] = useState("");
  const [objectType, setObjectType] = useState("");
  const [target, setTarget] = useState("");
  const [sensitivity, setSensitivity] = useState<AuditSensitivity | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState("Audit filters ready");
  const [loadingLabel, setLoadingLabel] = useState("Loading audit log");

  const queryAudit = useCallback(async (): Promise<void> => {
    setLoadingLabel("Loading audit log");
    const result = await invoke("audit:query", {
      action: action || undefined,
      objectType: objectType || undefined,
      target: target || undefined,
      sensitivity: sensitivity || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      limit: 100
    });
    if (!result.ok) {
      setStatus(result.error.message);
      setLoadingLabel("");
      return;
    }
    setEvents(result.value.events);
    setStatus(`${result.value.events.length} audit events`);
    setLoadingLabel("");
  }, [action, dateFrom, dateTo, invoke, objectType, sensitivity, target]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void queryAudit();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [queryAudit]);

  return (
    <section className="route-surface" aria-labelledby="audit-title">
      <header className="route-header">
        <h1 className="route-title" id="audit-title">
          Audit log
        </h1>
        <p className="route-summary">Review append-only local actions by type, target, sensitivity, and date.</p>
      </header>

      <section className="console-panel audit-panel" aria-label="Audit filters">
        <div className="field-grid audit-filter-grid">
          <label className="compact-field">
            Action
            <input className="field-control" value={action} onChange={(event) => setAction(event.target.value)} />
          </label>
          <label className="compact-field">
            Type
            <input className="field-control" value={objectType} onChange={(event) => setObjectType(event.target.value)} />
          </label>
          <label className="compact-field">
            Target
            <input className="field-control" value={target} onChange={(event) => setTarget(event.target.value)} />
          </label>
          <label className="compact-field">
            Sensitivity
            <select
              className="field-control"
              value={sensitivity}
              onChange={(event) => setSensitivity(event.target.value as AuditSensitivity | "")}
            >
              <option value="">Any</option>
              {auditSensitivityValues.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="compact-field">
            From
            <input className="field-control" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label className="compact-field">
            To
            <input className="field-control" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>
          <button className="action-button" type="button" onClick={() => void queryAudit()}>
            <Filter size={16} aria-hidden="true" />
            Apply filters
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="Refresh audit log"
            title="Refresh audit log"
            onClick={() => void queryAudit()}
          >
            <RefreshCw size={16} aria-hidden="true" />
          </button>
        </div>
        <span className="status-text" role="status">
          {status}
        </span>
      </section>

      <section className="console-panel audit-panel" aria-label="Audit events">
        <div className="table-list">
          {events.map((event) => (
            <div className="audit-event-row" key={event.id}>
              <div>
                <strong>{displayAuditText(event.action)}</strong>
                <span className="status-text">
                  {displayAuditText(event.objectType)} / {event.objectId ?? "no target"} / {event.sensitivity}
                </span>
              </div>
              <span className="status-text">{event.ts}</span>
              <code className="audit-detail">{displayAuditDetail(event.detail)}</code>
            </div>
          ))}
          {events.length === 0 ? <p className="status-text">No audit events match these filters.</p> : null}
        </div>
      </section>
      {loadingLabel ? <div className="route-loading" role="status">{loadingLabel}</div> : null}
    </section>
  );
}

function displayAuditText(value: string): string {
  return value.replaceAll("authorization", "target-review").replaceAll("Authorization", "Target review");
}

function displayAuditDetail(detail: unknown): string {
  return displayAuditText(JSON.stringify(detail));
}
