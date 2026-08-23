/**
 * The Analyzers route is an import desk with terminal-style results. File
 * parsing and lookups remain in main, while the renderer focuses on inputs,
 * progress, and readable long output.
 */
import { BadgeCheck, Bug, Copy, FileUp, Fingerprint, FolderOpen, GitBranch, Info, Mail, MapPin, Network, Route, Search, ShieldAlert } from "lucide-react";
import type { CSSProperties, DragEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type {
  AnalyzerFinding,
  DorkResult,
  EmailHeaderReport,
  EvtxEvent,
  Ioc,
  MacLookupResult,
  MalwareTriageReport,
  PcapConversation,
  VirusTotalReport,
  VulnerabilityRecord
} from "../../shared/schemas/analyzers";
import type { CaseRecord } from "../../shared/schemas/cases";
import type { EmailAuthVerdict, EvtxLevel } from "../../shared/types/analyzers";
import { evtxLevelValues } from "../../shared/types/analyzers";
import { useReacherClient } from "../hooks/use-reacher-client";

type AnalyzerMode = "evtx" | "pcap" | "dorks" | "mac" | "vuln" | "virustotal" | "malware" | "email";

interface VirusTotalSelection {
  readonly name: string;
  readonly size: number;
  readonly sha256: string;
}

const analyzerModes: readonly { readonly id: AnalyzerMode; readonly label: string; readonly summary: string }[] = [
  { id: "evtx", label: "EVTX import", summary: "Windows event logs" },
  { id: "pcap", label: "PCAP import", summary: "Packet conversations" },
  { id: "dorks", label: "Dork builder", summary: "Search queries" },
  { id: "mac", label: "MAC lookup", summary: "OUI vendor" },
  { id: "vuln", label: "CVE lookup", summary: "Product versions" },
  { id: "virustotal", label: "VirusTotal", summary: "Dropped file reports" },
  { id: "malware", label: "Malware triage", summary: "Static file analysis" },
  { id: "email", label: "Email / phishing", summary: "Header + hop tracing" }
];

export function AnalyzersView() {
  const { invoke } = useReacherClient();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AnalyzerMode>("dorks");
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [caseId, setCaseId] = useState("");
  const [evtxPath, setEvtxPath] = useState("C:\\Windows\\System32\\winevt\\Logs\\Security.evtx");
  const [evtxEventId, setEvtxEventId] = useState("4624");
  const [evtxProvider, setEvtxProvider] = useState("");
  const [evtxLevel, setEvtxLevel] = useState("");
  const [pcapPath, setPcapPath] = useState("/mnt/c/captures/sample.pcapng");
  const [wslDistro, setWslDistro] = useState("Ubuntu");
  const [dorkTarget, setDorkTarget] = useState("example.com");
  const [mac, setMac] = useState("00:1A:2B:00:00:01");
  const [product, setProduct] = useState("nginx");
  const [version, setVersion] = useState("1.25");
  const [virusTotalFile, setVirusTotalFile] = useState<VirusTotalSelection | null>(null);
  const [virusTotalReport, setVirusTotalReport] = useState<VirusTotalReport | null>(null);
  const [virusTotalDragging, setVirusTotalDragging] = useState(false);
  const [virusTotalLoading, setVirusTotalLoading] = useState(false);
  const [malwarePath, setMalwarePath] = useState("");
  const [malwareReport, setMalwareReport] = useState<MalwareTriageReport | null>(null);
  const [malwareLoading, setMalwareLoading] = useState(false);
  const [rawHeaders, setRawHeaders] = useState("");
  const [emailReport, setEmailReport] = useState<EmailHeaderReport | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [status, setStatus] = useState("Loading analyzers");
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EvtxEvent[]>([]);
  const [conversations, setConversations] = useState<PcapConversation[]>([]);
  const [dorks, setDorks] = useState<DorkResult[]>([]);
  const [macResult, setMacResult] = useState<MacLookupResult | null>(null);
  const [vulnerabilities, setVulnerabilities] = useState<VulnerabilityRecord[]>([]);
  const [findings, setFindings] = useState<AnalyzerFinding[]>([]);

  const refreshCases = useCallback(async () => {
    setLoading(true);
    const result = await invoke("cases:list", {});
    if (!result.ok) {
      setStatus(result.error.message);
      setLoading(false);
      return;
    }
    setCases(result.value.cases);
    setCaseId((current) => current || result.value.cases[0]?.id || "");
    setStatus("Analyzer desk ready");
    setLoading(false);
  }, [invoke]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void refreshCases();
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [refreshCases]);

  const terminalBlocks = useMemo(() => [
    ...dorks.map((dork) => ({ id: `dork-${dork.query}`, label: dork.label, value: dork.query })),
    ...events.map((event) => ({ id: `event-${event.provider}-${event.eventId}-${event.timestamp}`, label: `${event.provider} ${event.eventId}`, value: `${event.level} ${event.message}` })),
    ...conversations.map((conversation) => ({ id: `pcap-${conversation.source}-${conversation.destination}-${conversation.protocol}`, label: `${conversation.protocol} conversation`, value: `${conversation.source} -> ${conversation.destination} packets:${conversation.packets} bytes:${conversation.bytes}` })),
    ...(macResult ? [{ id: `mac-${macResult.oui}`, label: macResult.vendor, value: `${macResult.oui} / ${macResult.source}` }] : []),
    ...vulnerabilities.map((vulnerability) => ({ id: vulnerability.id, label: vulnerability.id, value: `${vulnerability.severity} ${vulnerability.summary}` })),
    ...(virusTotalReport
      ? [
          {
            id: `vt-${virusTotalReport.sha256}`,
            label: `VirusTotal ${virusTotalReport.fileName}`,
            value: virusTotalSummary(virusTotalReport)
          },
          ...virusTotalReport.topDetections.slice(0, 6).map((detection) => ({
            id: `vt-${virusTotalReport.sha256}-${detection.engineName}`,
            label: `${detection.engineName} ${detection.category}`,
            value: detection.result ?? "No family label"
          }))
        ]
      : [])
  ], [conversations, dorks, events, macResult, vulnerabilities, virusTotalReport]);

  async function importEvtx() {
    setMode("evtx");
    setStatus("Importing EVTX");
    const result = await invoke("analyzer:evtx:import", {
      filePath: evtxPath,
      caseId: caseId || undefined,
      eventId: evtxEventId ? Number(evtxEventId) : undefined,
      provider: evtxProvider || undefined,
      level: evtxLevel ? evtxLevel as EvtxLevel : undefined
    });
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setEvents(result.value.events);
    setFindings(result.value.findings);
    setStatus(`Imported ${result.value.events.length} event log entries`);
  }

  async function importPcap() {
    setMode("pcap");
    setStatus("Importing PCAP");
    const result = await invoke("analyzer:pcap:import", {
      filePath: pcapPath,
      wslDistro,
      caseId: caseId || undefined
    });
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setConversations(result.value.conversations);
    setFindings(result.value.findings);
    setStatus(`Imported ${result.value.conversations.length} conversations`);
  }

  async function buildDorks() {
    setMode("dorks");
    setStatus("Building dorks");
    const result = await invoke("analyzer:dork:build", { target: dorkTarget, caseId: caseId || undefined });
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setDorks(result.value.dorks);
    setFindings(result.value.findings);
    setStatus(`Built ${result.value.dorks.length} dorks`);
  }

  async function lookupMac() {
    setMode("mac");
    setStatus("Looking up MAC");
    const result = await invoke("analyzer:mac:lookup", { mac, caseId: caseId || undefined });
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setMacResult(result.value.result);
    setFindings(result.value.findings);
    setStatus(`Resolved ${result.value.result.oui}`);
  }

  async function lookupVulnerabilities() {
    setMode("vuln");
    setStatus("Looking up CVEs");
    const result = await invoke("analyzer:vuln:lookup", { product, version: version || undefined, caseId: caseId || undefined });
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setVulnerabilities(result.value.vulnerabilities);
    setFindings(result.value.findings);
    setStatus(result.value.cached ? "Loaded cached CVEs" : `Loaded ${result.value.vulnerabilities.length} CVEs`);
  }

  async function lookupVirusTotal(selection: VirusTotalSelection): Promise<void> {
    setMode("virustotal");
    setVirusTotalLoading(true);
    setStatus("Looking up VirusTotal report");
    const result = await invoke("analyzer:virustotal:lookup", {
      sha256: selection.sha256,
      fileName: selection.name,
      fileSize: selection.size,
      caseId: caseId || undefined
    });
    if (!result.ok) {
      setStatus(result.error.message);
      setVirusTotalLoading(false);
      return;
    }
    setVirusTotalReport(result.value.report);
    setFindings(result.value.findings);
    setStatus(`VirusTotal report loaded for ${selection.name}`);
    setVirusTotalLoading(false);
  }

  async function analyzeVirusTotalFile(file: File): Promise<void> {
    setMode("virustotal");
    setVirusTotalReport(null);
    setVirusTotalLoading(true);
    setStatus(`Hashing ${file.name}`);
    try {
      const selection = { name: file.name, size: file.size, sha256: await hashFileSha256(file) };
      setVirusTotalFile(selection);
      await lookupVirusTotal(selection);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "VirusTotal lookup failed");
      setVirusTotalLoading(false);
    }
  }

  function handleVirusTotalDrop(event: DragEvent<HTMLLabelElement>): void {
    event.preventDefault();
    setVirusTotalDragging(false);
    const file = event.dataTransfer.files.item(0);
    if (file) {
      void analyzeVirusTotalFile(file);
    }
  }

  async function pickMalwareFile(): Promise<void> {
    const result = await invoke("system:pickFile", {});
    if (result.ok && result.value.filePath) {
      setMalwarePath(result.value.filePath);
      setStatus("File selected for triage");
    }
  }

  async function runMalwareTriage(): Promise<void> {
    if (!malwarePath.trim()) {
      setStatus("Choose a file to triage first");
      return;
    }
    setMode("malware");
    setMalwareReport(null);
    setMalwareLoading(true);
    setStatus("Triaging file (static, not executed)");
    const result = await invoke("analyzer:malware:triage", { filePath: malwarePath, caseId: caseId || undefined });
    if (!result.ok) {
      setStatus(result.error.message);
      setMalwareLoading(false);
      return;
    }
    setMalwareReport(result.value.report);
    setFindings(result.value.findings);
    setStatus(`Triage complete — risk ${result.value.report.riskScore}/100, ${result.value.report.iocs.length} IOCs`);
    setMalwareLoading(false);
  }

  async function analyzeEmailHeaders(): Promise<void> {
    if (!rawHeaders.trim()) {
      setStatus("Paste the email's raw headers first");
      return;
    }
    setMode("email");
    setEmailReport(null);
    setEmailLoading(true);
    setStatus("Parsing headers (offline, nothing is executed or fetched)");
    const result = await invoke("analyzer:email:headers", { rawHeaders, caseId: caseId || undefined });
    if (!result.ok) {
      setStatus(result.error.message);
      setEmailLoading(false);
      return;
    }
    setEmailReport(result.value.report);
    setFindings(result.value.findings);
    const { report } = result.value;
    setStatus(`Traced ${report.hops.length} hop${report.hops.length === 1 ? "" : "s"} — risk ${report.riskScore}/100 (spf:${report.auth.spf} dkim:${report.auth.dkim} dmarc:${report.auth.dmarc})`);
    setEmailLoading(false);
  }

  function pivotDomain(domain: string): void {
    void navigate("/search", { state: { seed: { type: "domain", value: domain } } });
  }

  function pivotIp(ip: string): void {
    void navigate("/search", { state: { seed: { type: "ip", value: ip } } });
  }

  function pivotIoc(ioc: Ioc): void {
    if (!ioc.seedType) {
      return;
    }
    // Router state, not a query string: an IOC pulled from a sample is untrusted
    // and must never ride in the URL. SearchView reads it once on arrival.
    void navigate("/search", { state: { seed: { type: ioc.seedType, value: ioc.value } } });
  }

  async function pickPath(setter: (path: string) => void): Promise<void> {
    const result = await invoke("system:pickFile", {});
    if (result.ok && result.value.filePath) {
      setter(result.value.filePath);
    }
  }

  async function copyText(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Copied to clipboard");
    } catch {
      setStatus("Clipboard unavailable");
    }
  }

  return (
    <section className="route-surface analyzers-surface" aria-labelledby="analyzers-title">
      <header className="route-header route-header-wide">
        <h1 className="route-title" id="analyzers-title">
          Analyzers
        </h1>
        <p className="route-summary">Import artifacts, generate dorks, and read long results in a terminal-style analysis stream.</p>
      </header>

      <div className="analyzer-desk">
        <section className="console-panel analyzer-import-panel">
          <div className="analyzer-mode-strip" role="tablist" aria-label="Analyzer tools">
            {analyzerModes.map((item) => (
              <button className={mode === item.id ? "analyzer-mode is-selected" : "analyzer-mode"} type="button" key={item.id} onClick={() => setMode(item.id)}>
                <strong>{item.label}</strong>
                <span>{item.summary}</span>
              </button>
            ))}
          </div>

          <div className="analyzer-common-grid">
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
            <label className="compact-field">
              WSL distro
              <input className="field-control" value={wslDistro} onChange={(event) => setWslDistro(event.target.value)} />
            </label>
          </div>

          {mode === "evtx" ? (
            <AnalyzerCard title="Event log import">
              <FileDropField label="Event log (.evtx)" value={evtxPath} onBrowse={() => void pickPath(setEvtxPath)} onPath={setEvtxPath} />
              <div className="analyzers-two-column">
                <AnalyzerField label="Event id" value={evtxEventId} onChange={setEvtxEventId} />
                <AnalyzerField label="Provider" value={evtxProvider} onChange={setEvtxProvider} />
              </div>
              <label className="compact-field">
                Level
                <select className="field-control" value={evtxLevel} onChange={(event) => setEvtxLevel(event.target.value)}>
                  <option value="">Any</option>
                  {evtxLevelValues.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </label>
              <button className="action-button primary-action" type="button" onClick={() => void importEvtx()}>
                <FileUp size={16} aria-hidden="true" />
                Import EVTX
              </button>
            </AnalyzerCard>
          ) : null}

          {mode === "pcap" ? (
            <AnalyzerCard title="Packet capture import">
              <FileDropField label="Capture (.pcap / .pcapng)" value={pcapPath} onBrowse={() => void pickPath(setPcapPath)} onPath={setPcapPath} />
              <button className="action-button primary-action" type="button" onClick={() => void importPcap()}>
                <Network size={16} aria-hidden="true" />
                Import PCAP
              </button>
            </AnalyzerCard>
          ) : null}

          {mode === "dorks" ? (
            <AnalyzerCard title="Dork builder">
              <AnalyzerField label="Target" value={dorkTarget} onChange={setDorkTarget} />
              <button className="action-button primary-action" type="button" onClick={() => void buildDorks()}>
                <Search size={16} aria-hidden="true" />
                Build dorks
              </button>
            </AnalyzerCard>
          ) : null}

          {mode === "mac" ? (
            <AnalyzerCard title="MAC vendor">
              <AnalyzerField label="MAC address" value={mac} onChange={setMac} />
              <button className="action-button primary-action" type="button" onClick={() => void lookupMac()}>
                <BadgeCheck size={16} aria-hidden="true" />
                Lookup MAC
              </button>
            </AnalyzerCard>
          ) : null}

          {mode === "vuln" ? (
            <AnalyzerCard title="Vulnerability lookup">
              <div className="analyzers-two-column">
                <label className="compact-field">
                  Product
                  <input className="field-control" list="vuln-products" value={product} onChange={(event) => setProduct(event.target.value)} placeholder="Pick or type a product" />
                  <datalist id="vuln-products">
                    {vulnProducts.map((entry) => (
                      <option key={entry} value={entry} />
                    ))}
                  </datalist>
                </label>
                <AnalyzerField label="Version" value={version} onChange={setVersion} />
              </div>
              <button className="action-button primary-action" type="button" onClick={() => void lookupVulnerabilities()}>
                <ShieldAlert size={16} aria-hidden="true" />
                Lookup CVEs
              </button>
            </AnalyzerCard>
          ) : null}

          {mode === "virustotal" ? (
            <AnalyzerCard title="VirusTotal file lookup">
              <label
                className={virusTotalDragging ? "virustotal-drop-zone is-dragging" : "virustotal-drop-zone"}
                onDragEnter={() => setVirusTotalDragging(true)}
                onDragOver={(event) => {
                  event.preventDefault();
                  setVirusTotalDragging(true);
                }}
                onDragLeave={() => setVirusTotalDragging(false)}
                onDrop={handleVirusTotalDrop}
              >
                <input
                  className="file-drop-input"
                  type="file"
                  aria-label="VirusTotal file"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.item(0);
                    event.currentTarget.value = "";
                    if (file) {
                      void analyzeVirusTotalFile(file);
                    }
                  }}
                />
                <FileUp size={24} aria-hidden="true" />
                <span>
                  <strong>{virusTotalFile ? virusTotalFile.name : "Drop file"}</strong>
                  <small>{virusTotalFile ? formatBytes(virusTotalFile.size) : "SHA-256 lookup"}</small>
                </span>
              </label>
              {virusTotalFile ? (
                <div className="virustotal-file-summary">
                  <span className="status-text">sha256</span>
                  <code>{virusTotalFile.sha256}</code>
                </div>
              ) : null}
              <button
                className="action-button primary-action"
                type="button"
                disabled={!virusTotalFile || virusTotalLoading}
                onClick={() => virusTotalFile ? void lookupVirusTotal(virusTotalFile) : undefined}
              >
                <ShieldAlert size={16} aria-hidden="true" />
                Lookup VirusTotal
              </button>
            </AnalyzerCard>
          ) : null}

          {mode === "malware" ? (
            <AnalyzerCard title="Malware triage">
              <p className="status-text">Static analysis only — the file is hashed and read, never executed.</p>
              <AnalyzerField label="File path" value={malwarePath} onChange={setMalwarePath} />
              <div className="action-row">
                <button className="action-button" type="button" onClick={() => void pickMalwareFile()}>
                  <FolderOpen size={16} aria-hidden="true" />
                  Browse file
                </button>
                <button
                  className="action-button primary-action"
                  type="button"
                  disabled={!malwarePath.trim() || malwareLoading}
                  onClick={() => void runMalwareTriage()}
                >
                  <Bug size={16} aria-hidden="true" />
                  Triage file
                </button>
              </div>
            </AnalyzerCard>
          ) : null}

          {mode === "email" ? (
            <AnalyzerCard title="Email / phishing analysis">
              <p className="status-text">
                Paste the full raw headers (Gmail: <em>Show original</em>; Outlook: <em>View message source</em>). Parsing is offline — no
                link is opened and nothing is fetched.
              </p>
              <label className="compact-field">
                Raw headers
                <textarea
                  className="field-control analyzer-headers-input"
                  value={rawHeaders}
                  onChange={(event) => setRawHeaders(event.target.value)}
                  placeholder={"Received: from mail.example.com (mail.example.com [203.0.113.5])\n  by mx.recipient.com with ESMTPS; Fri, 15 Aug 2026 09:14:22 -0700\nAuthentication-Results: mx.recipient.com; spf=pass dkim=pass dmarc=pass\nFrom: \"Support\" <support@example.com>\nReturn-Path: <bounce@example.com>\nSubject: Your account"}
                  rows={9}
                  spellCheck={false}
                />
              </label>
              <div className="action-row">
                <button className="action-button" type="button" onClick={() => setRawHeaders("")} disabled={!rawHeaders.trim() || emailLoading}>
                  Clear
                </button>
                <button
                  className="action-button primary-action"
                  type="button"
                  disabled={!rawHeaders.trim() || emailLoading}
                  onClick={() => void analyzeEmailHeaders()}
                >
                  <Mail size={16} aria-hidden="true" />
                  Analyze headers
                </button>
              </div>
            </AnalyzerCard>
          ) : null}
        </section>

        <section className="console-panel analyzer-terminal-panel" aria-labelledby="analysis-terminal-title">
          <div className="section-title-row section-title-row-wide">
            <h2 className="section-title" id="analysis-terminal-title">Analysis terminal</h2>
            <span className="status-text">{status}</span>
          </div>
          {mode === "dorks" && dorks.length > 0 ? (
            <button className="action-button" type="button" onClick={() => void copyText(dorks.map((dork) => dork.query).join("\n"))}>
              <Copy size={16} aria-hidden="true" />
              Copy all {dorks.length} dorks
            </button>
          ) : null}
          <div className="terminal-output terminal-lines" role="log" aria-live="polite">
            <div className="terminal-line">$ reacher analyzer --mode {mode}</div>
            {terminalBlocks.map((item) => (
              <div className="terminal-record terminal-record-copyable" key={item.id}>
                <strong>{item.label}</strong>
                <span>{item.value}</span>
                <button
                  className="icon-button terminal-copy"
                  type="button"
                  aria-label={`Copy ${item.label}`}
                  title="Copy to clipboard"
                  onClick={() => void copyText(item.value)}
                >
                  <Copy size={14} aria-hidden="true" />
                </button>
              </div>
            ))}
            {terminalBlocks.length === 0 ? <div className="terminal-line">$ No analyzer output yet.</div> : null}
          </div>
          {virusTotalReport ? <VirusTotalReportDetails report={virusTotalReport} /> : null}
          {malwareReport ? <MalwareReportDetails report={malwareReport} onPivot={pivotIoc} /> : null}
          {emailReport ? <EmailReportDetails report={emailReport} onPivotDomain={pivotDomain} onPivotIp={pivotIp} /> : null}
        </section>

        <section className="console-panel analyzer-findings-panel" aria-labelledby="analyzer-findings-title">
          <div className="section-title-row section-title-row-wide">
            <h2 className="section-title" id="analyzer-findings-title">Analysis stream — findings</h2>
            <span className="status-text">{findings.length}</span>
          </div>
          <div className="analyzer-finding-list">
            {findings.map((finding) => (
              <article className={`analyzer-finding-card finding-${finding.severity}`} key={finding.id}>
                <span className="finding-icon" aria-hidden="true">
                  {finding.severity === "high" ? <ShieldAlert size={16} /> : finding.severity === "medium" ? <BadgeCheck size={16} /> : <Info size={16} />}
                </span>
                <div className="finding-body">
                  <strong>
                    <span className="finding-level">{findingLevel(finding.severity)}</span>: {finding.title} <em>| {finding.analyzer}</em>
                  </strong>
                  <span className="status-text">{finding.source}</span>
                </div>
              </article>
            ))}
            {findings.length === 0 ? <p className="status-text">Run an analyzer to see saveable findings.</p> : null}
          </div>
        </section>
      </div>

      <div className="analyzer-status-bar" role="status">
        <span className={`analyzer-status-light ${loading || virusTotalLoading || malwareLoading || emailLoading ? "is-busy" : ""}`} aria-hidden="true" />
        Status: {status}. {loading || virusTotalLoading || malwareLoading || emailLoading ? "Working…" : "Console ready."}
      </div>

      {loading || virusTotalLoading || malwareLoading || emailLoading ? (
        <div className="route-loading" role="status">{virusTotalLoading || malwareLoading || emailLoading ? status : "Loading analyzer desk"}</div>
      ) : null}
    </section>
  );
}

function findingLevel(severity: string): string {
  if (severity === "high") {
    return "CRIT";
  }
  if (severity === "medium") {
    return "WARN";
  }
  return "INFO";
}

function AnalyzerCard(props: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section className="analyzer-card" aria-label={props.title}>
      <h2 className="section-title">{props.title}</h2>
      {props.children}
    </section>
  );
}

function AnalyzerField(props: { readonly label: string; readonly value: string; readonly onChange: (value: string) => void }) {
  return (
    <label className="compact-field">
      {props.label}
      <input className="field-control" value={props.value} onChange={(event) => props.onChange(event.target.value)} />
    </label>
  );
}

/**
 * A browse + drag-and-drop control for artifact imports. Click opens the native
 * picker (a real filesystem path the main process can read); a dropped file uses
 * its path when the platform exposes one, so common cases avoid typing a path.
 */
function FileDropField(props: {
  readonly label: string;
  readonly value: string;
  readonly onBrowse: () => void;
  readonly onPath: (path: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <label
      className={dragging ? "analyzer-drop-zone is-dragging" : "analyzer-drop-zone"}
      onDragEnter={() => setDragging(true)}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const dropped = event.dataTransfer.files.item(0);
        // Electron exposes a real filesystem path on dropped files; the DOM File
        // type does not, so reach through unknown to read it when present.
        const path = dropped ? (dropped as unknown as { readonly path?: string }).path : undefined;
        if (path) {
          props.onPath(path);
        }
      }}
      onClick={props.onBrowse}
    >
      <FolderOpen size={22} aria-hidden="true" />
      <span>
        <strong>{props.label}</strong>
        <small>{props.value ? props.value : "Click to browse, or drag a file here"}</small>
      </span>
    </label>
  );
}

const vulnProducts: readonly string[] = [
  "nginx",
  "apache",
  "openssh",
  "openssl",
  "mysql",
  "postgresql",
  "mongodb",
  "redis",
  "elasticsearch",
  "wordpress",
  "drupal",
  "joomla",
  "tomcat",
  "jenkins",
  "gitlab",
  "windows",
  "linux kernel",
  "vmware esxi",
  "cisco ios",
  "fortinet fortios",
  "log4j",
  "exchange server"
];

function VirusTotalReportDetails(props: { readonly report: VirusTotalReport }) {
  const stats = props.report.detectionStats;
  const statRows = [
    ["Malicious", stats.malicious],
    ["Suspicious", stats.suspicious],
    ["Harmless", stats.harmless],
    ["Undetected", stats.undetected],
    ["Timeout", stats.timeout],
    ["Unsupported", stats.typeUnsupported]
  ] as const;

  return (
    <div className="virustotal-report">
      <div className="virustotal-stat-grid" aria-label="VirusTotal detection stats">
        {statRows.map(([label, value]) => (
          <div className="virustotal-stat" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="virustotal-detail-grid">
        <div>
          <span className="status-text">Type</span>
          <strong>{props.report.typeDescription ?? "unknown"}</strong>
        </div>
        <div>
          <span className="status-text">Last analysis</span>
          <strong>{formatTimestamp(props.report.lastAnalysisTs)}</strong>
        </div>
        <div>
          <span className="status-text">Reputation</span>
          <strong>{props.report.reputation ?? 0}</strong>
        </div>
        <div>
          <span className="status-text">Threat label</span>
          <strong>{props.report.threatLabel ?? "none"}</strong>
        </div>
      </div>

      <div className="virustotal-engine-list" aria-label="VirusTotal engine detections">
        {props.report.topDetections.map((detection) => (
          <div className="terminal-record" key={`${detection.engineName}-${detection.category}`}>
            <strong>{detection.engineName} / {detection.category}</strong>
            <span>{detection.result ?? "No family label"} {detection.engineVersion ? `/ ${detection.engineVersion}` : ""}</span>
          </div>
        ))}
        {props.report.topDetections.length === 0 ? <div className="terminal-line">$ No malicious or suspicious engine detections.</div> : null}
      </div>

      <pre className="virustotal-raw-json">{JSON.stringify(props.report.rawJson, null, 2)}</pre>
    </div>
  );
}

function MalwareReportDetails(props: { readonly report: MalwareTriageReport; readonly onPivot: (ioc: Ioc) => void }) {
  const { report } = props;
  const riskClass = report.riskScore >= 66 ? "malware-risk-high" : report.riskScore >= 33 ? "malware-risk-medium" : "malware-risk-low";
  const hashRows = [
    ["SHA-256", report.sha256],
    ["SHA-1", report.sha1],
    ["MD5", report.md5]
  ] as const;

  return (
    <div className="malware-report">
      <div className={`malware-risk-banner ${riskClass}`}>
        <div className="malware-risk-score">
          <strong>{report.riskScore}</strong>
          <span>/ 100 risk</span>
        </div>
        <div className="malware-risk-summary">
          <strong>{report.fileType}{report.truncated ? " · truncated" : ""}</strong>
          <span>{formatBytes(report.fileSize)} · entropy {report.overallEntropy} · {report.stringCount} strings · {report.iocs.length} IOCs</span>
        </div>
      </div>

      <ul className="malware-reason-list" aria-label="Risk reasons">
        {report.riskReasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>

      <div className="malware-hash-grid" aria-label="File hashes">
        {hashRows.map(([label, value]) => (
          <div className="malware-hash-row" key={label}>
            <span className="status-text"><Fingerprint size={13} aria-hidden="true" /> {label}</span>
            <code>{value}</code>
          </div>
        ))}
      </div>

      {report.pe ? (
        <div className="malware-pe" aria-label="PE analysis">
          <h3 className="agents-subtitle">PE header</h3>
          <div className="virustotal-detail-grid">
            <div>
              <span className="status-text">Machine</span>
              <strong>{report.pe.machine}</strong>
            </div>
            <div>
              <span className="status-text">Kind</span>
              <strong>{report.pe.isDll ? "DLL" : "EXE"} · {report.pe.subsystem}</strong>
            </div>
            <div>
              <span className="status-text">Compiled</span>
              <strong>{report.pe.compileTimestampTs ? formatTimestamp(report.pe.compileTimestampTs) : "unknown/zeroed"}</strong>
            </div>
            <div>
              <span className="status-text">Signed</span>
              <strong>{report.pe.hasAuthenticode ? "Authenticode present" : "unsigned"}</strong>
            </div>
          </div>

          <div className="malware-section-list" aria-label="PE sections">
            {report.pe.sections.map((section) => (
              <div className={section.suspicious ? "malware-section-row is-suspicious" : "malware-section-row"} key={section.name}>
                <code>{section.name}</code>
                <span className="malware-entropy-track" title={`entropy ${section.entropy}`}>
                  <span className="malware-entropy-fill" style={{ "--entropy-share": `${(section.entropy / 8) * 100}%` } as CSSProperties} />
                </span>
                <span className="status-text">{section.entropy.toFixed(2)}{section.suspicious ? " · packed?" : ""}</span>
              </div>
            ))}
          </div>

          {report.pe.suspiciousImports.length > 0 ? (
            <div className="malware-imports">
              <span className="status-text">Capability imports</span>
              <div className="malware-chip-row">
                {report.pe.suspiciousImports.map((name) => (
                  <span className="malware-chip" key={name}>{name}</span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="malware-ioc-panel" aria-label="Extracted indicators">
        <h3 className="agents-subtitle">Indicators of compromise</h3>
        {report.iocs.length === 0 ? (
          <p className="status-text">No indicators extracted from strings.</p>
        ) : (
          <div className="malware-ioc-list">
            {report.iocs.slice(0, 60).map((ioc) => (
              <div className="malware-ioc-row" key={`${ioc.kind}:${ioc.value}`}>
                <span className="malware-ioc-kind">{ioc.kind}</span>
                <code className="malware-ioc-value">{ioc.value}</code>
                <span className="status-text">x{ioc.occurrences}</span>
                {ioc.seedType ? (
                  <button className="action-button malware-pivot" type="button" title={`Search this ${ioc.seedType}`} onClick={() => props.onPivot(ioc)}>
                    <GitBranch size={14} aria-hidden="true" />
                    Pivot
                  </button>
                ) : (
                  <span className="status-pill">evidence</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {report.notableStrings.length > 0 ? (
        <details className="malware-strings">
          <summary>Notable strings ({report.notableStrings.length})</summary>
          <pre className="virustotal-raw-json">{report.notableStrings.join("\n")}</pre>
        </details>
      ) : null}
    </div>
  );
}

/**
 * The email report reads like the annotated screenshot the user shared: a risk
 * banner, the three authentication lights, sender-identity alignment, spoofing
 * flags, and the delivery path drawn origin → recipient with each org and delay.
 * Every hop and sender domain carries a pivot into search so a phishing trace
 * flows straight into correlation.
 */
function EmailReportDetails(props: {
  readonly report: EmailHeaderReport;
  readonly onPivotDomain: (domain: string) => void;
  readonly onPivotIp: (ip: string) => void;
}) {
  const { report } = props;
  const riskClass = report.riskScore >= 60 ? "malware-risk-high" : report.riskScore >= 30 ? "malware-risk-medium" : "malware-risk-low";
  const authRows: readonly (readonly [string, EmailAuthVerdict, string])[] = [
    ["SPF", report.auth.spf, "Sending server authorized by the From domain's DNS"],
    ["DKIM", report.auth.dkim, "Cryptographic signature verified and unbroken"],
    ["DMARC", report.auth.dmarc, "Alignment matches the domain owner's published policy"]
  ];
  const senderRows: readonly { readonly label: string; readonly value: string | null; readonly domain: string | null }[] = [
    { label: "From", value: report.from, domain: report.fromDomain },
    { label: "Return-Path", value: report.returnPath, domain: report.returnPathDomain },
    { label: "Reply-To", value: report.replyTo, domain: report.replyToDomain }
  ];

  return (
    <div className="email-report">
      <div className={`malware-risk-banner ${riskClass}`}>
        <div className="malware-risk-score">
          <strong>{report.riskScore}</strong>
          <span>/ 100 risk</span>
        </div>
        <div className="malware-risk-summary">
          <strong>{report.subject ?? "(no subject)"}</strong>
          <span>
            {report.hops.length} hop{report.hops.length === 1 ? "" : "s"}
            {report.totalTransitSeconds !== null ? ` · ${formatDuration(report.totalTransitSeconds)} in transit` : ""}
            {report.originatingIp ? ` · origin ${report.originatingIp}` : ""}
          </span>
        </div>
      </div>

      <div className="email-auth-grid" aria-label="Authentication results">
        {authRows.map(([label, verdict, hint]) => (
          <div className="email-auth-card" key={label}>
            <span className={`status-dot ${emailAuthDotClass(verdict)}`} aria-hidden="true" />
            <div className="email-auth-body">
              <strong>{label}</strong>
              <span className="email-auth-verdict">{verdict}</span>
              <small className="status-text">{hint}</small>
            </div>
          </div>
        ))}
      </div>

      <div className="email-sender-panel" aria-label="Sender addresses">
        <h3 className="agents-subtitle">Sender identity</h3>
        {senderRows.map((row) => {
          const domain = row.domain;
          return (
            <div className="email-sender-row" key={row.label}>
              <span className="status-text">{row.label}</span>
              <code>{row.value ?? "—"}</code>
              {domain ? (
                <button className="action-button malware-pivot" type="button" title={`Search ${domain}`} onClick={() => props.onPivotDomain(domain)}>
                  <GitBranch size={13} aria-hidden="true" />
                  Pivot
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {report.spoofingIndicators.length > 0 ? (
        <div className="email-spoof-panel" aria-label="Spoofing indicators">
          <h3 className="agents-subtitle">
            <ShieldAlert size={15} aria-hidden="true" /> Spoofing indicators
          </h3>
          <ul className="malware-reason-list">
            {report.spoofingIndicators.map((indicator) => (
              <li key={indicator}>{indicator}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="status-text email-clean-note">
          <BadgeCheck size={14} aria-hidden="true" /> No sender-alignment mismatches detected.
        </p>
      )}

      <div className="email-hop-panel" aria-label="Delivery path">
        <h3 className="agents-subtitle">
          <Route size={15} aria-hidden="true" /> Delivery path (origin → recipient)
        </h3>
        {report.hops.length === 0 ? (
          <p className="status-text">No Received hops parsed — the headers may be incomplete.</p>
        ) : (
          <ol className="email-hop-list">
            {report.hops.map((hop, index) => {
              const ip = hop.ip;
              return (
                <li className={index === 0 ? "email-hop is-origin" : "email-hop"} key={hop.index}>
                  <span className="email-hop-index">{index + 1}</span>
                  <div className="email-hop-body">
                    <div className="email-hop-line">
                      <MapPin size={13} aria-hidden="true" />
                      <strong>{hop.fromHost ?? hop.byHost ?? "unknown host"}</strong>
                      {hop.org ? <span className="email-hop-org">{hop.org}</span> : null}
                      {index === 0 ? <span className="status-pill">origin</span> : null}
                    </div>
                    <div className="email-hop-meta">
                      {ip ? <code>{ip}</code> : null}
                      {hop.protocol ? <span className="status-text">{hop.protocol}</span> : null}
                      {hop.timestamp ? <span className="status-text">{formatTimestamp(hop.timestamp)}</span> : null}
                      {hop.delaySeconds !== null ? <span className="email-hop-delay">+{formatDuration(hop.delaySeconds)}</span> : null}
                      {ip ? (
                        <button className="action-button malware-pivot" type="button" title={`Search ${ip}`} onClick={() => props.onPivotIp(ip)}>
                          <GitBranch size={13} aria-hidden="true" />
                          Pivot
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="email-risk-panel" aria-label="Risk reasoning">
        <h3 className="agents-subtitle">Why this score</h3>
        <ul className="malware-reason-list">
          {report.riskReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function emailAuthDotClass(verdict: EmailAuthVerdict): string {
  switch (verdict) {
    case "pass":
      return "status-dot-verified";
    case "fail":
    case "permerror":
      return "status-dot-error";
    case "softfail":
    case "neutral":
    case "temperror":
      return "status-dot-candidate";
    default:
      // none / unknown: the check was absent rather than failed, so it reads as a
      // neutral gray light, not the red an actual fail earns.
      return "status-dot-untested";
  }
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
}

async function hashFileSha256(file: File): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

function virusTotalSummary(report: VirusTotalReport): string {
  const stats = report.detectionStats;
  return `malicious:${stats.malicious} suspicious:${stats.suspicious} harmless:${stats.harmless} undetected:${stats.undetected}`;
}

function formatTimestamp(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "unknown";
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }
  const units = ["KB", "MB", "GB"] as const;
  let size = value / 1024;
  let unit: string = units[0];
  for (let index = 1; index < units.length && size >= 1024; index += 1) {
    size /= 1024;
    unit = units[index];
  }
  return `${size.toFixed(size >= 10 ? 1 : 2)} ${unit}`;
}
