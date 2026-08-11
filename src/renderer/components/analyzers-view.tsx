/**
 * The Analyzers view is a form-driven import desk, not a parser host, because
 * file handling and external lookups must stay in main. If this route parsed
 * EVTX, PCAP, or CVEs itself, renderer failures could fork evidence behavior.
 */
import { BadgeCheck, FileUp, Network, Search, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type {
  AnalyzerFinding,
  DorkResult,
  EvtxEvent,
  MacLookupResult,
  PcapConversation,
  VulnerabilityRecord
} from "../../shared/schemas/analyzers";
import type { CaseRecord } from "../../shared/schemas/cases";
import type { EvtxLevel } from "../../shared/types/analyzers";
import { evtxLevelValues } from "../../shared/types/analyzers";
import { useReacherClient } from "../hooks/use-reacher-client";

export function AnalyzersView() {
  const { invoke } = useReacherClient();
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
  const [status, setStatus] = useState("Analyzers ready");
  const [events, setEvents] = useState<EvtxEvent[]>([]);
  const [conversations, setConversations] = useState<PcapConversation[]>([]);
  const [dorks, setDorks] = useState<DorkResult[]>([]);
  const [macResult, setMacResult] = useState<MacLookupResult | null>(null);
  const [vulnerabilities, setVulnerabilities] = useState<VulnerabilityRecord[]>([]);
  const [findings, setFindings] = useState<AnalyzerFinding[]>([]);

  const refreshCases = useCallback(async () => {
    const result = await invoke("cases:list", {});
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setCases(result.value.cases);
    setCaseId((current) => current || result.value.cases[0]?.id || "");
  }, [invoke]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void refreshCases();
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [refreshCases]);

  async function importEvtx() {
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
    const result = await invoke("analyzer:vuln:lookup", { product, version: version || undefined, caseId: caseId || undefined });
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setVulnerabilities(result.value.vulnerabilities);
    setFindings(result.value.findings);
    setStatus(result.value.cached ? "Loaded cached CVEs" : `Loaded ${result.value.vulnerabilities.length} CVEs`);
  }

  return (
    <section className="route-surface" aria-labelledby="analyzers-title">
      <header className="route-header">
        <h1 className="route-title" id="analyzers-title">
          Analyzers
        </h1>
        <p className="route-summary">Import event logs and captures, build local dorks, resolve MAC vendors, and cache CVE lookups.</p>
      </header>

      <div className="analyzers-command-row">
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
        <p className="status-text">{status}</p>
      </div>

      <div className="analyzers-layout">
        <section className="console-panel analyzers-panel">
          <h2 className="section-title">Event log</h2>
          <AnalyzerField label="EVTX path" value={evtxPath} onChange={setEvtxPath} />
          <div className="analyzers-two-column">
            <AnalyzerField label="Event id" value={evtxEventId} onChange={setEvtxEventId} />
            <AnalyzerField label="Provider" value={evtxProvider} onChange={setEvtxProvider} />
          </div>
          <label className="compact-field">
            Level
            <select className="field-control" value={evtxLevel} onChange={(event) => setEvtxLevel(event.target.value)}>
              <option value="">Any</option>
              {evtxLevelValues.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
          <button className="action-button" type="button" onClick={() => void importEvtx()}>
            <FileUp size={18} />
            Import EVTX
          </button>
          <ResultList
            empty="No event log results yet."
            items={events.map((event) => ({
              id: `${event.provider}-${event.eventId}-${event.timestamp}`,
              title: `${event.provider} ${event.eventId}`,
              detail: `${event.level} / ${event.message}`
            }))}
          />
        </section>

        <section className="console-panel analyzers-panel">
          <h2 className="section-title">Packet capture</h2>
          <AnalyzerField label="PCAP path" value={pcapPath} onChange={setPcapPath} />
          <AnalyzerField label="WSL distro" value={wslDistro} onChange={setWslDistro} />
          <p className="status-text">File import only through tshark -r.</p>
          <button className="action-button" type="button" onClick={() => void importPcap()}>
            <Network size={18} />
            Import PCAP
          </button>
          <ResultList
            empty="No capture results yet."
            items={conversations.map((conversation) => ({
              id: `${conversation.source}-${conversation.destination}-${conversation.protocol}`,
              title: `${conversation.source} to ${conversation.destination}`,
              detail: `${conversation.protocol} packets:${conversation.packets} bytes:${conversation.bytes}`
            }))}
          />
        </section>

        <section className="console-panel analyzers-panel">
          <h2 className="section-title">Dorks</h2>
          <AnalyzerField label="Target" value={dorkTarget} onChange={setDorkTarget} />
          <button className="action-button" type="button" onClick={() => void buildDorks()}>
            <Search size={18} />
            Build dorks
          </button>
          <ResultList
            empty="No dorks built yet."
            items={dorks.map((dork) => ({ id: dork.query, title: dork.label, detail: dork.query }))}
          />
        </section>

        <section className="console-panel analyzers-panel">
          <h2 className="section-title">MAC vendor</h2>
          <AnalyzerField label="MAC address" value={mac} onChange={setMac} />
          <button className="action-button" type="button" onClick={() => void lookupMac()}>
            <BadgeCheck size={18} />
            Lookup MAC
          </button>
          <ResultList
            empty="No MAC lookup yet."
            items={macResult ? [{ id: macResult.oui, title: macResult.vendor, detail: `${macResult.oui} / ${macResult.source}` }] : []}
          />
        </section>

        <section className="console-panel analyzers-panel">
          <h2 className="section-title">Vulnerabilities</h2>
          <div className="analyzers-two-column">
            <AnalyzerField label="Product" value={product} onChange={setProduct} />
            <AnalyzerField label="Version" value={version} onChange={setVersion} />
          </div>
          <button className="action-button" type="button" onClick={() => void lookupVulnerabilities()}>
            <ShieldAlert size={18} />
            Lookup CVEs
          </button>
          <ResultList
            empty="No vulnerabilities loaded yet."
            items={vulnerabilities.map((vulnerability) => ({
              id: vulnerability.id,
              title: vulnerability.id,
              detail: `${vulnerability.severity} / ${vulnerability.summary}`
            }))}
          />
        </section>

        <section className="console-panel analyzers-panel">
          <h2 className="section-title">Findings</h2>
          <ResultList
            empty="Run an analyzer to see saveable findings."
            items={findings.map((finding) => ({
              id: finding.id,
              title: finding.title,
              detail: `${finding.analyzer} / ${finding.source}`
            }))}
          />
        </section>
      </div>
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

function ResultList(props: { readonly empty: string; readonly items: readonly { readonly id: string; readonly title: string; readonly detail: string }[] }) {
  return (
    <div className="table-list">
      {props.items.map((item) => (
        <div key={item.id} className="analyzer-result-row">
          <strong>{item.title}</strong>
          <span className="status-text">{item.detail}</span>
        </div>
      ))}
      {props.items.length === 0 ? <p className="status-text">{props.empty}</p> : null}
    </div>
  );
}
