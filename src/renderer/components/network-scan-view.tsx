/**
 * The Network scan view is a builder over typed scan options, not a command
 * prompt. If it assembled nmap strings directly, the active authorization gate
 * and fixed WSL argv path would no longer protect Jack's scan scope.
 */
import { ReactFlow, Background, Controls, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { FileText, Play, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ScanHost, ScanOptions, ScanOutputEvent, ScanTopology } from "../../shared/schemas/scans";
import type { ScanTiming, ScanType } from "../../shared/types/scans";
import { useReacherClient } from "../hooks/use-reacher-client";

const scanTypes: readonly ScanType[] = ["ping-sweep", "quick-top-100", "full-tcp", "service-version", "os-detect", "vuln-nse", "custom"];
const timingOptions: readonly ScanTiming[] = ["T2", "T3", "T4"];

export function NetworkScanView() {
  const { invoke } = useReacherClient();
  const [target, setTarget] = useState("192.168.1.0/24");
  const [wslDistro, setWslDistro] = useState("Ubuntu");
  const [scanType, setScanType] = useState<ScanType>("quick-top-100");
  const [timing, setTiming] = useState<ScanTiming>("T3");
  const [ports, setPorts] = useState("");
  const [customArgs, setCustomArgs] = useState("");
  const [skipHostDiscovery, setSkipHostDiscovery] = useState(false);
  const [serviceVersion, setServiceVersion] = useState(false);
  const [osDetect, setOsDetect] = useState(false);
  const [vulnScripts, setVulnScripts] = useState(false);
  const [scanId, setScanId] = useState("");
  const [hosts, setHosts] = useState<ScanHost[]>([]);
  const [topology, setTopology] = useState<ScanTopology | null>(null);
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState("Ready to scan");

  useEffect(() => {
    const unsubscribe = window.reacher.onScanEvent("scan:output", (event: ScanOutputEvent) => {
      setOutput((current) => `${current}${event.chunk}`);
    });
    return unsubscribe;
  }, []);

  const options: ScanOptions = {
    scanType,
    timing,
    ports: ports || undefined,
    customArgs: customArgs.split(/\s+/).filter(Boolean),
    skipHostDiscovery,
    serviceVersion,
    osDetect,
    vulnScripts
  };

  const flow = useMemo(() => toFlow(topology), [topology]);

  async function authorizeTarget() {
    const expiresTs = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const result = await invoke("auth:create", { target, tier: "active", expiresTs });
    setStatus(result.ok ? "Target authorized" : result.error.message);
  }

  async function runScan() {
    setOutput("");
    setStatus("Running scan");
    const result = await invoke("scan:run", { target, wslDistro, options });
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setScanId(result.value.scan.id);
    setHosts(result.value.hosts);
    setTopology(result.value.topology);
    setOutput(result.value.scan.stdout || result.value.scan.stderr);
    setStatus(result.value.scan.status === "blocked" ? "Scan blocked" : `Scan ${result.value.scan.status}`);
  }

  async function exportReport() {
    if (!scanId) {
      setStatus("Run a scan before exporting");
      return;
    }
    const result = await invoke("report:generate", { scanId, format: "pdf" });
    setStatus(result.ok ? "Generated scan report" : result.error.message);
  }

  return (
    <section className="route-surface">
      <header className="route-header">
        <h1 className="route-title">Network scan</h1>
        <p className="route-summary">Run authorized nmap scans, parse hosts and ports, and compare deterministic topology.</p>
      </header>
      <div className="scan-layout">
        <section className="console-panel scan-builder-panel">
          <h2 className="section-title">Builder</h2>
          <div className="scan-command-grid">
            <label className="compact-field">
              Target
              <input className="field-control" value={target} onChange={(event) => setTarget(event.target.value)} />
            </label>
            <label className="compact-field">
              WSL distro
              <input className="field-control" value={wslDistro} onChange={(event) => setWslDistro(event.target.value)} />
            </label>
            <label className="compact-field">
              Scan type
              <select className="field-control" value={scanType} onChange={(event) => setScanType(event.target.value as ScanType)}>
                {scanTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="compact-field">
              Timing
              <select className="field-control" value={timing} onChange={(event) => setTiming(event.target.value as ScanTiming)}>
                {timingOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="compact-field">
              Ports
              <input className="field-control" value={ports} onChange={(event) => setPorts(event.target.value)} />
            </label>
            <label className="compact-field">
              Custom argv
              <input className="field-control" value={customArgs} onChange={(event) => setCustomArgs(event.target.value)} />
            </label>
          </div>
          <div className="scan-toggle-grid">
            <Toggle label="Skip host discovery" checked={skipHostDiscovery} onChange={setSkipHostDiscovery} />
            <Toggle label="Service version" checked={serviceVersion} onChange={setServiceVersion} />
            <Toggle label="OS detect" checked={osDetect} onChange={setOsDetect} />
            <Toggle label="Vuln scripts" checked={vulnScripts} onChange={setVulnScripts} />
          </div>
          <div className="action-row">
            <button className="action-button" type="button" onClick={() => void authorizeTarget()}>
              <ShieldCheck size={18} />
              Authorize target
            </button>
            <button className="action-button" type="button" onClick={() => void runScan()}>
              <Play size={18} />
              Run scan
            </button>
            <button className="action-button" type="button" onClick={() => void exportReport()}>
              <FileText size={18} />
              Export report
            </button>
          </div>
          <p className="status-text">{status}</p>
        </section>

        <section className="console-panel scan-topology-panel">
          <h2 className="section-title">Topology</h2>
          <div className="scan-flow" aria-label="Scan topology">
            <ReactFlow nodes={flow.nodes} edges={flow.edges} fitView>
              <Background />
              <Controls />
            </ReactFlow>
          </div>
        </section>

        <section className="console-panel scan-host-panel">
          <h2 className="section-title">Hosts</h2>
          <div className="table-list">
            {hosts.map((host) => (
              <div key={host.id} className="scan-host-row">
                <strong>{host.address}</strong>
                <span>{host.status}</span>
                <span className="status-text">{host.hostname ?? "no hostname"} / ring:{host.hopDistance}</span>
                <span className="status-text">{host.ports.map((port) => `${port.port}/${port.protocol} ${port.service || port.state}`).join(", ") || "no ports"}</span>
              </div>
            ))}
            {hosts.length === 0 ? <p className="status-text">No parsed hosts yet.</p> : null}
          </div>
        </section>

        <section className="console-panel scan-output-panel">
          <h2 className="section-title">Output</h2>
          <pre className="tools-output">{output || "No scan output captured yet."}</pre>
        </section>
      </div>
    </section>
  );
}

function Toggle(props: { readonly label: string; readonly checked: boolean; readonly onChange: (checked: boolean) => void }) {
  return (
    <label className="settings-toggle">
      <input type="checkbox" checked={props.checked} onChange={(event) => props.onChange(event.target.checked)} />
      {props.label}
    </label>
  );
}

function toFlow(topology: ScanTopology | null): { readonly nodes: Node[]; readonly edges: Edge[] } {
  if (!topology) {
    return { nodes: [], edges: [] };
  }
  return {
    nodes: topology.nodes.map((node) => ({
      id: node.id,
      position: { x: node.x, y: node.y },
      data: { label: node.label }
    })),
    edges: topology.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target
    }))
  };
}
