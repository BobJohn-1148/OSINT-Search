/**
 * MethodologyMapView is a launchpad and coverage checklist, not a tool runner.
 * If phase chips executed commands, the renderer could bypass the main-process
 * launch path already enforced by the Tools and Scan services.
 */
import { BookOpen, CircleDot, Download, ExternalLink, Link2, Map, PlayCircle, Route, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { MethodologyPhase } from "../../shared/schemas/methodology";
import { resourcesForPhase } from "./methodology-resources";
import { useReacherClient } from "../hooks/use-reacher-client";

export function MethodologyMapView() {
  const { invoke } = useReacherClient();
  const navigate = useNavigate();
  const [phases, setPhases] = useState<MethodologyPhase[]>([]);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [status, setStatus] = useState("Methodology map ready");
  const [loadingLabel, setLoadingLabel] = useState("Loading methodology map");
  const selectedPhase = selectedPhaseId ? phases.find((phase) => phase.id === selectedPhaseId) : null;
  const selectedIndex = selectedPhase ? phases.findIndex((phase) => phase.id === selectedPhase.id) : -1;

  const refresh = useCallback(async () => {
    setLoadingLabel("Loading methodology map");
    const result = await invoke("methodology:list", {});
    if (!result.ok) {
      setStatus(result.error.message);
      setLoadingLabel("");
      return;
    }
    setPhases(result.value.phases);
    if (selectedPhaseId === null) {
      setSelectedPhaseId(result.value.phases[0]?.id ?? null);
    }
    setLoadingLabel("");
  }, [invoke, selectedPhaseId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refresh]);

  async function exportCoverage(): Promise<void> {
    setLoadingLabel("Exporting methodology coverage");
    const result = await invoke("methodology:export", {});
    if (!result.ok) {
      setStatus(result.error.message);
      setLoadingLabel("");
      return;
    }
    setStatus(`Exported ${result.value.filename} with ${result.value.csv.split("\n").length - 1} rows`);
    setLoadingLabel("");
  }

  return (
    <section className="route-surface" aria-labelledby="methodology-title">
      <header className="route-header">
        <h1 className="route-title" id="methodology-title">
          Methodology map
        </h1>
        <p className="route-summary">Navigate OWASP, PTES, and OSSTMM coverage through Reacher surfaces and linked tool entries.</p>
      </header>

      <div className="methodology-layout">
        <section className="console-panel methodology-flow" aria-label="Methodology phases">
          <div className="methodology-panel-heading">
            <Route size={18} aria-hidden="true" />
            <div>
              <h2 className="section-title">Engagement flow</h2>
              <span className="status-text">{phases.length} phases mapped</span>
            </div>
          </div>
          {phases.map((phase, index) => (
            <div className="methodology-flow-step" key={phase.id}>
              <button
                className={phase.id === selectedPhaseId ? "methodology-phase is-selected" : "methodology-phase"}
                type="button"
                aria-pressed={phase.id === selectedPhaseId}
                onClick={() => setSelectedPhaseId(phase.id)}
              >
                <span className="methodology-phase-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="methodology-phase-copy">
                  <strong>{phase.title}</strong>
                  <span>{phase.summary}</span>
                </span>
                <span className="methodology-phase-meta">
                  {phase.tools.length} tools
                </span>
              </button>
              {index < phases.length - 1 ? <span className="methodology-connector" aria-hidden="true" /> : null}
            </div>
          ))}
        </section>

        <section className="console-panel methodology-detail" aria-label="Methodology details">
          <div className="section-title-row">
            <div>
              <span className="methodology-kicker">{selectedIndex >= 0 ? `Phase ${selectedIndex + 1}` : "Coverage"}</span>
              <h2 className="section-title">{selectedPhase ? selectedPhase.title : "Coverage"}</h2>
            </div>
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
                <CircleDot className="methodology-tool-icon" size={16} aria-hidden="true" />
                <div className="methodology-tool-main">
                  <div className="methodology-tool-title">
                    <strong>{tool.label}</strong>
                    <span className={`methodology-tier methodology-tier-${tool.tier}`}>{tool.tier}</span>
                  </div>
                  <span className="status-text">{tool.surface}</span>
                  <code className="audit-detail">{tool.command}</code>
                  <span className="status-text">
                    {tool.input} to {tool.output}
                  </span>
                </div>
                <button className="icon-button" type="button" aria-label={`Open ${tool.label}`} title={`Open ${tool.label}`} onClick={() => { void navigate(toolHref(tool)); }}>
                  <Link2 size={15} aria-hidden="true" />
                </button>
              </div>
            )) : null}
          </div>

          {selectedPhase ? (
            <div className="methodology-resources-block" aria-label="Guides and resources">
              <ResourceGroup icon={<BookOpen size={14} aria-hidden="true" />} title="Guides" items={resourcesForPhase(selectedPhase.title).guides} />
              <ResourceGroup icon={<PlayCircle size={14} aria-hidden="true" />} title="Videos" items={resourcesForPhase(selectedPhase.title).videos} />
              <ResourceGroup icon={<Wrench size={14} aria-hidden="true" />} title="Tools & resources" items={resourcesForPhase(selectedPhase.title).tools} />
            </div>
          ) : null}
        </section>
      </div>
      {loadingLabel ? <div className="route-loading" role="status">{loadingLabel}</div> : null}
    </section>
  );
}

function ResourceGroup(props: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly items: readonly { readonly label: string; readonly url: string }[];
}) {
  if (props.items.length === 0) {
    return null;
  }
  return (
    <div className="methodology-resource-group">
      <span className="methodology-resource-heading">
        {props.icon}
        {props.title}
      </span>
      <div className="methodology-resource-links">
        {props.items.map((item) => (
          <a className="methodology-resource-link" key={item.url} href={item.url} target="_blank" rel="noreferrer">
            {item.label}
            <ExternalLink size={12} aria-hidden="true" />
          </a>
        ))}
      </div>
    </div>
  );
}

function toolHref(tool: MethodologyPhase["tools"][number]): string {
  if (tool.surface === "Tools") {
    return `/tools?tool=${encodeURIComponent(tool.id)}`;
  }
  if (tool.surface === "Search") {
    return "/search";
  }
  if (tool.surface === "Analyzers") {
    return "/analyzers";
  }
  if (tool.surface === "Network scan") {
    return "/network-scan";
  }
  if (tool.surface === "Cases" || tool.surface === "Reports") {
    return "/cases";
  }
  if (tool.surface === "Audit log") {
    return "/audit-log";
  }
  return "/methodology-map";
}
