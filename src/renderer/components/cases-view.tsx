/**
 * Cases is the investigation workspace: case metadata, editable working papers,
 * saved evidence, and generated reports live together so the user does not have
 * to jump between disconnected surfaces to build a deliverable.
 *
 * A VS Code-style file tree fronts the case: Documents / Evidence / Reports are
 * folders you expand, and clicking any node opens it in the central pane — the
 * document editor for working papers, a read-only viewer for evidence and
 * reports. Everything is one selection model so "open a thing and look at it"
 * works the same whatever the thing is.
 */
import {
  Archive,
  CalendarDays,
  ChevronRight,
  FileDown,
  FileText,
  FolderOpen,
  FolderPlus,
  Paperclip,
  RefreshCw,
  Save,
  Search,
  ScrollText
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CaseDocument, CaseItem, CaseRecord, CaseSummary } from "../../shared/schemas/cases";
import type { ReportRecord } from "../../shared/schemas/reports";
import type { ReportFormat } from "../../shared/types/reports";
import { useReacherClient } from "../hooks/use-reacher-client";

interface DocumentDraft {
  readonly documentId?: string;
  readonly name: string;
  readonly scope: string;
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly body: string;
}

type TreeFolderId = "documents" | "evidence" | "reports";
type ActiveNode = { readonly kind: "document" | "evidence" | "report"; readonly id: string } | null;

const today = new Date().toISOString().slice(0, 10);
const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

function emptyDocumentDraft(caseTitle = "Investigation"): DocumentDraft {
  return {
    name: `${caseTitle} document`,
    scope: "Scope to be confirmed",
    dateFrom: today,
    dateTo: nextWeek,
    body: ""
  };
}

export function CasesView() {
  const { invoke } = useReacherClient();
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [selectedCase, setSelectedCase] = useState<CaseRecord | null>(null);
  const [timeline, setTimeline] = useState<CaseItem[]>([]);
  const [summary, setSummary] = useState<CaseSummary | null>(null);
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [title, setTitle] = useState("New investigation");
  const [tags, setTags] = useState("client, osint");
  const [query, setQuery] = useState("");
  const [format, setFormat] = useState<ReportFormat>("pdf");
  const [draft, setDraft] = useState<DocumentDraft>(() => emptyDocumentDraft());
  const [activeNode, setActiveNode] = useState<ActiveNode>(null);
  const [expandedFolders, setExpandedFolders] = useState<ReadonlySet<TreeFolderId>>(new Set(["documents", "evidence", "reports"]));
  const [status, setStatus] = useState("Loading cases");
  const [loading, setLoading] = useState(true);
  const [savingDocument, setSavingDocument] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  const filteredReports = useMemo(
    () => reports.filter((report) => !selectedCase || report.caseId === selectedCase.id),
    [reports, selectedCase]
  );
  const evidenceCount = Object.values(summary?.counts ?? {}).reduce((total, count) => total + count, 0);
  const activeEvidence = activeNode?.kind === "evidence" ? timeline.find((item) => item.id === activeNode.id) ?? null : null;
  const activeReport = activeNode?.kind === "report" ? filteredReports.find((report) => report.id === activeNode.id) ?? null : null;

  function toggleFolder(id: TreeFolderId): void {
    setExpandedFolders((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function openDocument(document: CaseDocument): void {
    setDraft(toDraft(document));
    setActiveNode({ kind: "document", id: document.id });
  }

  const refresh = useCallback(async (caseId?: string): Promise<void> => {
    setLoading(true);
    const [listResult, reportsResult] = await Promise.all([
      invoke("cases:list", {}),
      invoke("report:list", {})
    ]);
    if (!listResult.ok) {
      setStatus(listResult.error.message);
      setLoading(false);
      return;
    }

    const nextReports =
      reportsResult.ok && Array.isArray(reportsResult.value.reports) ? reportsResult.value.reports : [];
    setReports(nextReports);

    const loadedCases = listResult.value.cases;
    setCases(loadedCases);
    const selectedCaseId = selectedCase?.id;
    const requestedCase = caseId ? loadedCases.find((item) => item.id === caseId) ?? null : null;
    const rememberedCase = selectedCaseId ? loadedCases.find((item) => item.id === selectedCaseId) ?? null : null;
    const firstCase = loadedCases.at(0) ?? null;
    const nextCase = requestedCase ?? rememberedCase ?? firstCase;
    setSelectedCase(nextCase);

    if (!nextCase) {
      setTimeline([]);
      setSummary(null);
      setDocuments([]);
      setDraft(emptyDocumentDraft());
      setActiveNode(null);
      setStatus("Create a case to start a document");
      setLoading(false);
      return;
    }

    const [timelineResult, summaryResult, documentsResult] = await Promise.all([
      invoke("case:timeline", { caseId: nextCase.id }),
      invoke("case:summary", { caseId: nextCase.id }),
      invoke("case:documents:list", { caseId: nextCase.id })
    ]);
    if (timelineResult.ok) {
      setTimeline(timelineResult.value.items);
    }
    if (summaryResult.ok) {
      setSummary(summaryResult.value.summary);
    }
    if (documentsResult.ok) {
      setDocuments(documentsResult.value.documents);
      setDraft(documentsResult.value.documents[0] ? toDraft(documentsResult.value.documents[0]) : emptyDocumentDraft(nextCase.title));
    }
    const error = [timelineResult, summaryResult, documentsResult, reportsResult].find((result) => !result.ok);
    setStatus(error?.ok === false ? error.error.message : "Case workspace ready");
    setLoading(false);
  }, [invoke, selectedCase?.id]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [refresh]);

  async function createCase(): Promise<void> {
    setStatus("Creating case");
    const result = await invoke("cases:create", {
      title,
      tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean)
    });
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setTitle("New investigation");
    setTags("client, osint");
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
    if (!selectedCase || !query.trim()) {
      return;
    }
    setStatus("Searching evidence");
    const result = await invoke("case:search", { caseId: selectedCase.id, query: query.trim() });
    if (result.ok) {
      setTimeline(result.value.items);
      setStatus("Evidence search complete");
    } else {
      setStatus(result.error.message);
    }
  }

  async function saveDocument(): Promise<void> {
    if (!selectedCase) {
      setStatus("Create a case before saving a document");
      return;
    }
    setSavingDocument(true);
    const result = await invoke("case:document:upsert", {
      documentId: draft.documentId,
      caseId: selectedCase.id,
      name: draft.name,
      scope: draft.scope,
      dateFrom: draft.dateFrom,
      dateTo: draft.dateTo,
      body: draft.body
    });
    setSavingDocument(false);
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setStatus("Document saved");
    await refresh(selectedCase.id);
  }

  async function generateReport(): Promise<void> {
    if (!selectedCase) {
      setStatus("Create a case before generating a report");
      return;
    }
    setGeneratingReport(true);
    const result = await invoke("report:generate", { caseId: selectedCase.id, format });
    setGeneratingReport(false);
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setStatus(`Generated ${result.value.report.format.toUpperCase()} report`);
    await refresh(selectedCase.id);
  }

  async function openReport(reportId: string): Promise<void> {
    const result = await invoke("report:open", { reportId });
    setStatus(result.ok ? "Report opened" : result.error.message);
  }

  function newDocument(): void {
    setDraft(emptyDocumentDraft(selectedCase?.title));
    setActiveNode(null);
    setStatus("New document draft");
  }

  return (
    <section className="route-surface cases-surface" aria-labelledby="cases-title">
      <header className="route-header route-header-wide">
        <h1 className="route-title" id="cases-title">
          Cases
        </h1>
        <p className="route-summary">Create investigations, browse the case file tree, edit working documents, and export reports from one workspace.</p>
      </header>

      <div className="case-create-bar console-panel">
        <label className="compact-field">
          Case name
          <input className="field-control" value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="compact-field">
          Tags
          <input className="field-control" value={tags} onChange={(event) => setTags(event.target.value)} />
        </label>
        <button className="action-button primary-action" type="button" onClick={() => void createCase()}>
          <FolderPlus size={16} aria-hidden="true" />
          Create case
        </button>
        <button className="icon-button" type="button" aria-label="Refresh cases" title="Refresh cases" onClick={() => void refresh()}>
          <RefreshCw size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="cases-workspace">
        <aside className="console-panel case-explorer" aria-labelledby="case-list-title">
          <h2 className="section-title" id="case-list-title">Investigations</h2>
          <div className="case-invest-list">
            {cases.map((item) => (
              <button
                className={item.id === selectedCase?.id ? "case-list-button is-selected" : "case-list-button"}
                key={item.id}
                type="button"
                onClick={() => void refresh(item.id)}
              >
                <span>{item.title}</span>
                <span className="status-text">{item.status} / {item.tags.join(", ") || "no tags"}</span>
              </button>
            ))}
            {!loading && cases.length === 0 ? <p className="status-text">No cases yet.</p> : null}
          </div>

          {selectedCase ? (
            <div className="case-file-tree" aria-label={`${selectedCase.title} files`}>
              <div className="case-tree-root">
                <FolderOpen size={14} aria-hidden="true" />
                {selectedCase.title}
              </div>

              <TreeFolder id="documents" label="Documents" count={documents.length} expanded={expandedFolders.has("documents")} onToggle={toggleFolder}>
                {documents.map((document) => (
                  <button
                    className={activeNode?.kind === "document" && activeNode.id === document.id ? "case-tree-item is-active" : "case-tree-item"}
                    type="button"
                    key={document.id}
                    onClick={() => openDocument(document)}
                  >
                    <FileText size={14} aria-hidden="true" />
                    <span>{document.name}</span>
                  </button>
                ))}
                {documents.length === 0 ? <p className="case-tree-empty status-text">No documents.</p> : null}
              </TreeFolder>

              <TreeFolder id="evidence" label="Evidence" count={timeline.length} expanded={expandedFolders.has("evidence")} onToggle={toggleFolder}>
                {timeline.map((item) => (
                  <button
                    className={activeNode?.kind === "evidence" && activeNode.id === item.id ? "case-tree-item is-active" : "case-tree-item"}
                    type="button"
                    key={item.id}
                    onClick={() => setActiveNode({ kind: "evidence", id: item.id })}
                  >
                    <Paperclip size={14} aria-hidden="true" />
                    <span>{item.title}</span>
                  </button>
                ))}
                {timeline.length === 0 ? <p className="case-tree-empty status-text">No evidence saved.</p> : null}
              </TreeFolder>

              <TreeFolder id="reports" label="Reports" count={filteredReports.length} expanded={expandedFolders.has("reports")} onToggle={toggleFolder}>
                {filteredReports.map((report) => (
                  <button
                    className={activeNode?.kind === "report" && activeNode.id === report.id ? "case-tree-item is-active" : "case-tree-item"}
                    type="button"
                    key={report.id}
                    onClick={() => setActiveNode({ kind: "report", id: report.id })}
                  >
                    <ScrollText size={14} aria-hidden="true" />
                    <span>{report.format.toUpperCase()} report</span>
                  </button>
                ))}
                {filteredReports.length === 0 ? <p className="case-tree-empty status-text">No reports yet.</p> : null}
              </TreeFolder>
            </div>
          ) : null}
        </aside>

        <section className="console-panel case-viewer-panel" aria-label="Case viewer">
          {activeEvidence ? (
            <EvidenceViewer item={activeEvidence} onBack={() => setActiveNode(null)} />
          ) : activeReport ? (
            <ReportViewer report={activeReport} onOpen={() => void openReport(activeReport.id)} onBack={() => setActiveNode(null)} />
          ) : (
            <>
              <div className="case-document-header">
                <div>
                  <h2 className="section-title" id="document-title">Document editor</h2>
                  <p className="status-text">{selectedCase ? selectedCase.title : "No case selected"}</p>
                </div>
                <div className="action-row">
                  <button className="action-button" type="button" onClick={newDocument}>New document</button>
                  <button className="action-button primary-action" type="button" disabled={savingDocument} onClick={() => void saveDocument()}>
                    <Save size={16} aria-hidden="true" />
                    {savingDocument ? "Saving" : "Save document"}
                  </button>
                </div>
              </div>
              <div className="document-meta-grid">
                <label className="compact-field">
                  Document name
                  <input className="field-control" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
                </label>
                <label className="compact-field">
                  Document scope
                  <input className="field-control" value={draft.scope} onChange={(event) => setDraft((current) => ({ ...current, scope: event.target.value }))} />
                </label>
                <label className="compact-field">
                  Start date
                  <input className="field-control" type="date" value={draft.dateFrom} onChange={(event) => setDraft((current) => ({ ...current, dateFrom: event.target.value }))} />
                </label>
                <label className="compact-field">
                  End date
                  <input className="field-control" type="date" value={draft.dateTo} onChange={(event) => setDraft((current) => ({ ...current, dateTo: event.target.value }))} />
                </label>
              </div>
              <textarea
                className="document-editor"
                value={draft.body}
                onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
                aria-label="Case document body"
                placeholder="Write scope notes, assumptions, evidence narrative, and report-ready sections."
              />
            </>
          )}
        </section>

        <aside className="case-side-stack">
          <section className="console-panel case-summary-card" aria-labelledby="summary-title">
            <div className="section-title-row section-title-row-wide">
              <h2 className="section-title" id="summary-title">Case health</h2>
              <button className="icon-button" type="button" aria-label="Archive case" title="Archive case" onClick={() => void archiveCase()}>
                <Archive size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="case-stats-grid">
              <Metric label="Evidence" value={String(evidenceCount)} />
              <Metric label="Documents" value={String(documents.length)} />
              <Metric label="Reports" value={String(filteredReports.length)} />
            </div>
            <div className="table-list">
              {(summary?.keyEntities ?? []).slice(0, 4).map((entity) => (
                <div className="provider-row" key={entity.entity}>
                  <span>{entity.entity}</span>
                  <span className="strength-pill">{entity.strength}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="console-panel case-tools-card" aria-labelledby="case-tools-title">
            <h2 className="section-title" id="case-tools-title">Case tools</h2>
            <div className="case-search-row">
              <input className="field-control" aria-label="Search case evidence" placeholder="Filter evidence" value={query} onChange={(event) => setQuery(event.target.value)} />
              <button className="icon-button" type="button" aria-label="Search case" title="Search case" onClick={() => void searchCase()}>
                <Search size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="case-report-header">
              <label className="compact-field compact-inline">
                Report format
                <select className="field-control" value={format} onChange={(event) => setFormat(event.target.value as ReportFormat)}>
                  <option value="pdf">PDF</option>
                  <option value="docx">Word</option>
                </select>
              </label>
            </div>
            <button className="action-button primary-action" type="button" disabled={generatingReport} onClick={() => void generateReport()}>
              <FileDown size={16} aria-hidden="true" />
              {generatingReport ? "Generating" : "Generate report"}
            </button>
          </section>
        </aside>
      </div>

      {loading ? <RouteLoading label="Loading case workspace" /> : null}
      <span className="status-text" role="status">
        {status}
      </span>
    </section>
  );
}

function TreeFolder(props: {
  readonly id: TreeFolderId;
  readonly label: string;
  readonly count: number;
  readonly expanded: boolean;
  readonly onToggle: (id: TreeFolderId) => void;
  readonly children: ReactNode;
}) {
  return (
    <div className={props.expanded ? "case-tree-folder is-open" : "case-tree-folder"}>
      <button className="case-tree-folder-head" type="button" aria-expanded={props.expanded} onClick={() => props.onToggle(props.id)}>
        <ChevronRight className="case-tree-chevron" size={14} aria-hidden="true" />
        <span className="case-tree-folder-label">{props.label}</span>
        <span className="case-tree-count">{props.count}</span>
      </button>
      {props.expanded ? <div className="case-tree-children">{props.children}</div> : null}
    </div>
  );
}

function EvidenceViewer(props: { readonly item: CaseItem; readonly onBack: () => void }) {
  const metadataEntries = Object.entries(props.item.metadata).slice(0, 12);
  return (
    <div className="case-viewer">
      <div className="case-viewer-head">
        <div>
          <span className="tool-card-kicker">{props.item.itemType} · evidence</span>
          <h2 className="section-title">{props.item.title}</h2>
        </div>
        <button className="action-button" type="button" onClick={props.onBack}>Back to editor</button>
      </div>
      <p className="console-line">{props.item.sourceTs}</p>
      <pre className="case-viewer-body">{props.item.text}</pre>
      {metadataEntries.length > 0 ? (
        <dl className="case-viewer-meta">
          {metadataEntries.map(([key, value]) => (
            <div className="case-viewer-meta-row" key={key}>
              <dt>{key}</dt>
              <dd>{formatMetaValue(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

function ReportViewer(props: { readonly report: ReportRecord; readonly onOpen: () => void; readonly onBack: () => void }) {
  return (
    <div className="case-viewer">
      <div className="case-viewer-head">
        <div>
          <span className="tool-card-kicker">{props.report.format.toUpperCase()} · report</span>
          <h2 className="section-title">{props.report.format.toUpperCase()} report</h2>
        </div>
        <button className="action-button" type="button" onClick={props.onBack}>Back to editor</button>
      </div>
      <p className="status-text">Generated {props.report.createdTs}</p>
      <code className="case-viewer-path">{props.report.path}</code>
      <div className="action-row">
        <button className="action-button primary-action" type="button" onClick={props.onOpen}>
          <FolderOpen size={16} aria-hidden="true" />
          Open report
        </button>
      </div>
    </div>
  );
}

function formatMetaValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function Metric(props: { readonly label: string; readonly value: string }) {
  return (
    <div className="metric-tile">
      <strong>{props.value}</strong>
      <span>{props.label}</span>
    </div>
  );
}

function RouteLoading(props: { readonly label: string }) {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <CalendarDays size={16} aria-hidden="true" />
      <span>{props.label}</span>
    </div>
  );
}

function toDraft(document: CaseDocument): DocumentDraft {
  return {
    documentId: document.id,
    name: document.name,
    scope: document.scope,
    dateFrom: document.dateFrom,
    dateTo: document.dateTo,
    body: document.body
  };
}
