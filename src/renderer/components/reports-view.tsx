/**
 * Reports is a real artifact surface because export actions need visible local
 * feedback and auditability. If generation lived behind a stub, users could
 * create sensitive files without seeing which case or format produced them.
 */
import { FileDown, FolderOpen, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { CaseRecord } from "../../shared/schemas/cases";
import type { ReportRecord } from "../../shared/schemas/reports";
import type { ReportFormat } from "../../shared/types/reports";
import { useReacherClient } from "../hooks/use-reacher-client";

export function ReportsView() {
  const { invoke } = useReacherClient();
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [format, setFormat] = useState<ReportFormat>("pdf");
  const [status, setStatus] = useState("Ready");

  const refresh = useCallback(async (): Promise<void> => {
    const [casesResult, reportsResult] = await Promise.all([
      invoke("cases:list", {}),
      invoke("report:list", {})
    ]);
    if (casesResult.ok) {
      setCases(casesResult.value.cases);
      setSelectedCaseId((current) => current || casesResult.value.cases[0]?.id || "");
    } else {
      setStatus(casesResult.error.message);
    }
    if (reportsResult.ok) {
      setReports(reportsResult.value.reports);
    } else {
      setStatus(reportsResult.error.message);
    }
  }, [invoke]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refresh]);

  async function generateReport(): Promise<void> {
    if (!selectedCaseId) {
      setStatus("Create a case before generating a report");
      return;
    }
    setStatus("Generating report");
    const result = await invoke("report:generate", { caseId: selectedCaseId, format });
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setStatus(`Generated ${result.value.report.format.toUpperCase()} report`);
    await refresh();
  }

  async function openReport(reportId: string): Promise<void> {
    const result = await invoke("report:open", { reportId });
    setStatus(result.ok ? "Report opened" : result.error.message);
  }

  return (
    <section className="route-surface" aria-labelledby="reports-title">
      <header className="route-header">
        <h1 className="route-title" id="reports-title">
          Reports
        </h1>
        <p className="route-summary">Generate cited PDF and Word reports from saved case evidence.</p>
      </header>

      <div className="report-command-row">
        <label className="compact-field">
          Case
          <select className="field-control" value={selectedCaseId} onChange={(event) => setSelectedCaseId(event.target.value)}>
            {cases.map((caseRecord) => (
              <option key={caseRecord.id} value={caseRecord.id}>
                {caseRecord.title}
              </option>
            ))}
          </select>
        </label>
        <label className="compact-field">
          Format
          <select className="field-control" value={format} onChange={(event) => setFormat(event.target.value as ReportFormat)}>
            <option value="pdf">PDF</option>
            <option value="docx">Word</option>
          </select>
        </label>
        <button className="action-button" type="button" onClick={() => void generateReport()}>
          <FileDown size={16} aria-hidden="true" />
          Generate report
        </button>
        <button className="icon-button" type="button" aria-label="Refresh reports" title="Refresh reports" onClick={() => void refresh()}>
          <RefreshCw size={16} aria-hidden="true" />
        </button>
      </div>

      <section className="console-panel settings-section" aria-labelledby="report-list-title">
        <h2 className="section-title" id="report-list-title">
          Generated reports
        </h2>
        <div className="table-list">
          {reports.map((report) => (
            <div className="report-row" key={report.id}>
              <div>
                <div className="provider-name">{report.format.toUpperCase()} report</div>
                <div className="status-text">{report.path}</div>
              </div>
              <span className="status-text">{report.createdTs}</span>
              <button className="icon-button" type="button" aria-label="Open report" title="Open report" onClick={() => void openReport(report.id)}>
                <FolderOpen size={16} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </section>
      <span className="status-text" role="status">
        {status}
      </span>
    </section>
  );
}
