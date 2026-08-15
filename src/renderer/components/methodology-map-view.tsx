/**
 * MethodologyMapView is a launchpad and coverage checklist, not a tool runner.
 * If phase chips executed commands, the renderer could bypass the exact-target
 * authorization gate already enforced by the Tools and Scan services.
 */
import { Download, Map, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { MethodologyPhase } from "../../shared/schemas/methodology";
import { useReacherClient } from "../hooks/use-reacher-client";

export function MethodologyMapView() {
  const { invoke } = useReacherClient();
  const [phases, setPhases] = useState<MethodologyPhase[]>([]);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [status, setStatus] = useState("Methodology map ready");
  const selectedPhase = selectedPhaseId ? phases.find((phase) => phase.id === selectedPhaseId) : null;

  const refresh = useCallback(async () => {
    const result = await invoke("methodology:list", {});
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setPhases(result.value.phases);
    if (selectedPhaseId === null) {
      setSelectedPhaseId(result.value.phases[0]?.id ?? null);
    }
  }, [invoke, selectedPhaseId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refresh]);

  async function exportCoverage(): Promise<void> {
    const result = await invoke("methodology:export", {});
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setStatus(`Exported ${result.value.filename} with ${result.value.csv.split("\n").length - 1} rows`);
  }

  return (
    <section className="route-surface" aria-labelledby="methodology-title">
      <header className="route-header">
        <h1 className="route-title" id="methodology-title">
          Methodology map
        </h1>
        <p className="route-summary">Navigate OWASP, PTES, and OSSTMM coverage through safe Reacher surfaces and gated tool entries.</p>
      </header>

      <div className="methodology-layout">
        <section className="console-panel methodology-flow" aria-label="Methodology phases">
          {phases.map((phase, index) => (
            <div className="methodology-flow-step" key={phase.id}>
              <button
                className={phase.id === selectedPhaseId ? "methodology-phase is-selected" : "methodology-phase"}
                type="button"
                onClick={() => setSelectedPhaseId(phase.id)}
              >
                <span className="metric-value">{index + 1}</span>
                <strong>{phase.title}</strong>
                <span className="status-text">{phase.summary}</span>
              </button>
              {index < phases.length - 1 ? <span className="methodology-connector" aria-hidden="true" /> : null}
            </div>
          ))}
        </section>

        <section className="console-panel methodology-detail" aria-label="Methodology details">
          <div className="section-title-row">
            <h2 className="section-title">{selectedPhase ? selectedPhase.title : "Coverage"}</h2>
            <button className="icon-button" type="button" aria-label="Export coverage spreadsheet" onClick={() => void exportCoverage()}>
              <Download size={16} aria-hidden="true" />
            </button>
          </div>
          <p className="status-text" role="status">
            {status}
          </p>
          <div className="methodology-refs">
            {selectedPhase ? selectedPhase.frameworkRefs.map((ref) => (
              <span className="methodology-ref" key={ref}>
                <Map size={14} aria-hidden="true" />
                {ref}
              </span>
            )) : null}
          </div>
          <div className="table-list">
            {selectedPhase ? selectedPhase.tools.map((tool) => (
              <div className="methodology-tool-row" key={tool.id}>
                <div>
                  <strong>{tool.label}</strong>
                  <span className="status-text">
                    {tool.surface} / {tool.tier}
                  </span>
                </div>
                {tool.authorizationRequired ? (
                  <span className="methodology-auth">
                    <ShieldCheck size={14} aria-hidden="true" />
                    Authorization
                  </span>
                ) : null}
                <code className="audit-detail">{tool.command}</code>
                <span className="status-text">
                  {tool.input} to {tool.output}
                </span>
              </div>
            )) : null}
          </div>
        </section>
      </div>
    </section>
  );
}
