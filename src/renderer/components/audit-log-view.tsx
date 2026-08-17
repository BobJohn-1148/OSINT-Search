/**
 * AuditLogView exposes append-only history through filters instead of direct
 * table browsing. If the renderer shaped these queries itself, sensitive review
 * could silently diverge from the main-process audit contract.
 */
import { Activity, Database, Filter, RefreshCw, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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

  const queryAudit = useCallback(async (): Promise<void> => {
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
      return;
    }
    setEvents(result.value.events);
    setStatus(`${result.value.events.length} audit events`);
  }, [action, dateFrom, dateTo, invoke, objectType, sensitivity, target]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void queryAudit();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [queryAudit]);

  const stats = useMemo(() => auditStats(events), [events]);

  return (
    <section className="route-surface" aria-labelledby="audit-title">
      <header className="route-header">
        <h1 className="route-title" id="audit-title">
          Audit log
        </h1>
        <p className="route-summary">Review append-only local actions by type, target, sensitivity, and date.</p>
      </header>

      <section className="console-panel audit-panel" aria-label="Audit filters">
        <div className="audit-summary-grid" aria-label="Audit summary">
          <AuditMetric icon={<Activity size={18} aria-hidden="true" />} label="Events" value={events.length} />
          <AuditMetric icon={<ShieldAlert size={18} aria-hidden="true" />} label="Sensitive" value={stats.sensitive} />
          <AuditMetric icon={<Database size={18} aria-hidden="true" />} label="Object types" value={stats.objectTypes} />
        </div>
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
        <div className="audit-quick-filters" aria-label="Quick audit filters">
          {["search.run", "agent.run", "scan.run", "keys.write"].map((value) => (
            <button className="audit-chip" type="button" key={value} onClick={() => setAction(value)}>
              {value}
            </button>
          ))}
          <button className="audit-chip" type="button" onClick={() => {
            setAction("");
            setObjectType("");
            setTarget("");
            setSensitivity("");
            setDateFrom("");
            setDateTo("");
          }}>
            Clear
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
              <div className="audit-event-main">
                <span className={`audit-sensitivity audit-sensitivity-${event.sensitivity}`}>{event.sensitivity}</span>
                <div>
                  <strong>{event.action}</strong>
                  <span className="status-text">
                    {event.objectType} / {event.objectId ?? "no target"} / {event.actor}
                  </span>
                </div>
              </div>
              <span className="status-text">{event.ts}</span>
              <div className="audit-detail">
                {Object.entries(event.detail).map(([key, value]) => (
                  <span key={key}>
                    <strong>{key}</strong>
                    <code>{formatDetailValue(value)}</code>
                  </span>
                ))}
              </div>
            </div>
          ))}
          {events.length === 0 ? <p className="status-text">No audit events match these filters.</p> : null}
        </div>
      </section>
    </section>
  );
}

function AuditMetric(props: { readonly icon: ReactNode; readonly label: string; readonly value: number }) {
  return (
    <div className="audit-metric">
      {props.icon}
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function auditStats(events: readonly AuditEvent[]): { readonly sensitive: number; readonly objectTypes: number } {
  return {
    sensitive: events.filter((event) => event.sensitivity === "sensitive" || event.sensitivity === "high").length,
    objectTypes: new Set(events.map((event) => event.objectType)).size
  };
}

function formatDetailValue(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}
