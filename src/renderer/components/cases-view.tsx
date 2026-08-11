/**
 * The Cases view is an evidence workspace instead of a placeholder because the
 * save-to-case invariant needs visible feedback as soon as search can produce
 * observations. If cases were only backend rows, investigators could save work
 * without being able to verify the timeline.
 */
import { Archive, FolderPlus, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { CaseItem, CaseRecord, CaseSummary } from "../../shared/schemas/cases";
import { useReacherClient } from "../hooks/use-reacher-client";

export function CasesView() {
  const { invoke } = useReacherClient();
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [selectedCase, setSelectedCase] = useState<CaseRecord | null>(null);
  const [timeline, setTimeline] = useState<CaseItem[]>([]);
  const [summary, setSummary] = useState<CaseSummary | null>(null);
  const [title, setTitle] = useState("New investigation");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Ready");

  const refresh = useCallback(async (caseId?: string): Promise<void> => {
    const listResult = await invoke("cases:list", {});
    if (!listResult.ok) {
      setStatus(listResult.error.message);
      return;
    }

    setCases(listResult.value.cases);
    let nextCase = listResult.value.cases.find((item) => item.id === caseId) ?? null;
    if (!nextCase && listResult.value.cases.length > 0) {
      nextCase = listResult.value.cases[0];
    }
    setSelectedCase(nextCase);
    if (!nextCase) {
      setTimeline([]);
      setSummary(null);
      setStatus("No cases yet");
      return;
    }

    const [timelineResult, summaryResult] = await Promise.all([
      invoke("case:timeline", { caseId: nextCase.id }),
      invoke("case:summary", { caseId: nextCase.id })
    ]);
    if (timelineResult.ok) {
      setTimeline(timelineResult.value.items);
    }
    if (summaryResult.ok) {
      setSummary(summaryResult.value.summary);
    }
    setStatus("Cases loaded");
  }, [invoke]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [refresh]);

  async function createCase(): Promise<void> {
    const result = await invoke("cases:create", { title, tags: [] });
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setTitle("New investigation");
    await refresh(result.value.case.id);
  }

  async function archiveCase(): Promise<void> {
    if (!selectedCase) {
      return;
    }
    const result = await invoke("cases:update", { caseId: selectedCase.id, status: "archived" });
    setStatus(result.ok ? "Case archived" : result.error.message);
    await refresh(selectedCase.id);
  }

  async function searchCase(): Promise<void> {
    if (!selectedCase || !query) {
      return;
    }
    const result = await invoke("case:search", { caseId: selectedCase.id, query });
    if (result.ok) {
      setTimeline(result.value.items);
      setStatus("Search complete");
    } else {
      setStatus(result.error.message);
    }
  }

  return (
    <section className="route-surface" aria-labelledby="cases-title">
      <header className="route-header">
        <h1 className="route-title" id="cases-title">
          Cases
        </h1>
        <p className="route-summary">Create cases, review saved evidence, and search within an investigation.</p>
      </header>

      <div className="case-command-row">
        <label className="compact-field">
          Title
          <input className="field-control" value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <button className="action-button" type="button" onClick={() => void createCase()}>
          <FolderPlus size={16} aria-hidden="true" />
          Create case
        </button>
        <button className="icon-button" type="button" aria-label="Refresh cases" title="Refresh cases" onClick={() => void refresh()}>
          <RefreshCw size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="cases-layout">
        <section className="console-panel settings-section" aria-labelledby="case-list-title">
          <h2 className="section-title" id="case-list-title">
            Case list
          </h2>
          <div className="table-list">
            {cases.map((item) => (
              <button className="case-list-button" key={item.id} type="button" onClick={() => void refresh(item.id)}>
                <span>{item.title}</span>
                <span className="status-text">{item.status}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="console-panel settings-section" aria-labelledby="timeline-title">
          <div className="section-title-row">
            <h2 className="section-title" id="timeline-title">
              Timeline
            </h2>
            <button className="icon-button" type="button" aria-label="Archive case" title="Archive case" onClick={() => void archiveCase()}>
              <Archive size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="case-search-row">
            <input className="field-control" value={query} onChange={(event) => setQuery(event.target.value)} />
            <button className="action-button" type="button" onClick={() => void searchCase()}>
              <Search size={16} aria-hidden="true" />
              Search case
            </button>
          </div>
          <div className="table-list">
            {timeline.map((item) => (
              <article className="timeline-item" key={item.id}>
                <div className="provider-name">{item.title}</div>
                <p className="status-text">{item.text}</p>
                <p className="console-line">{item.sourceTs}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="console-panel settings-section" aria-labelledby="summary-title">
          <h2 className="section-title" id="summary-title">
            Summary
          </h2>
          <p className="status-text">Items: {Object.values(summary?.counts ?? {}).reduce((total, count) => total + count, 0)}</p>
          <div className="table-list">
            {(summary?.keyEntities ?? []).map((entity) => (
              <div className="provider-row" key={entity.entity}>
                <span>{entity.entity}</span>
                <span className="strength-pill">{entity.strength}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
      <span className="status-text" role="status">
        {status}
      </span>
    </section>
  );
}
