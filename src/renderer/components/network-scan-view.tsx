/**
 * The Network scan view is a builder over typed scan options, not a command
 * prompt. If it assembled nmap strings directly, the fixed WSL argv path would
 * no longer protect scan scope.
 */
import { ReactFlow, Background, Controls, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ChevronRight, FileText, Monitor, Play, Server } from "lucide-react";
import type { ReactNode } from "react";
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
  const [loadingLabel, setLoadingLabel] = useState("");
  const [expandedHosts, setExpandedHosts] = useState<ReadonlySet<string>>(new Set());

  function toggleHost(id: string): void {
    setExpandedHosts((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

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
  const scanCommand = buildScanCommand(target, options);

  async function runScan() {
    setOutput("");
    setLoadingLabel("Running network scan");
    setStatus("Running scan");
    const expiresTs = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const approval = await invoke("auth:create", { target, tier: "active", expiresTs });
    if (!approval.ok) {
      setStatus(approval.error.message);
      setLoadingLabel("");
      return;
    }
    const result = await invoke("scan:run", { target, wslDistro, options });
    if (!result.ok) {
      setStatus(result.error.message);
      setLoadingLabel("");
      return;
    }
    setScanId(result.value.scan.id);
    setHosts(result.value.hosts);
    setTopology(result.value.topology);
    setOutput(result.value.scan.stdout || result.value.scan.stderr);
    setStatus(`Scan ${result.value.scan.status}`);
    setLoadingLabel("");
  }

  async function exportReport() {
    if (!scanId) {
      setStatus("Run a scan before exporting");
      return;
    }
    setLoadingLabel("Exporting scan report");
    const result = await invoke("report:generate", { scanId, format: "pdf" });
    setStatus(result.ok ? "Generated scan report" : result.error.message);
    setLoadingLabel("");
  }

  return (
    <section className="route-surface">
      <header className="route-header">
        <h1 className="route-title">Network scan</h1>
        <p className="route-summary">Build structured nmap scans, parse hosts and ports, and compare deterministic topology.</p>
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
            <button className={loadingLabel ? "action-button primary-action is-active" : "action-button primary-action"} type="button" disabled={Boolean(loadingLabel)} onClick={() => void runScan()}>
              <Play size={18} />
              Run scan
            </button>
            {scanId && !loadingLabel ? (
              <button className="action-button" type="button" onClick={() => void exportReport()}>
                <FileText size={18} />
                Save scan to report
              </button>
            ) : null}
          </div>
          {loadingLabel ? (
            <div className="scan-progress" role="progressbar" aria-label="Scan in progress">
              <span className="scan-progress-bar" />
            </div>
          ) : null}
          <p className="status-text">{status}</p>
        </section>

        <section className="console-panel scan-topology-panel">
          <h2 className="section-title">Topology</h2>
          <div className="scan-terminal">
            <div className="scan-terminal-bar">
              <span className="scan-terminal-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <span className="scan-terminal-title">local-nmap/topology</span>
            </div>
            <div className="scan-terminal-command">
              <span className="scan-terminal-prompt">$</span> {scanCommand}
            </div>
            <div className="scan-terminal-comment">
              {topology ? `# scan complete — ${flow.nodes.length} node(s) rendered` : "# awaiting scan — run a scan to render the map"}
            </div>
            <div className="scan-flow" aria-label="Scan topology">
              <ReactFlow nodes={flow.nodes} edges={flow.edges} fitView proOptions={{ hideAttribution: true }}>
                <Background />
                <Controls />
              </ReactFlow>
            </div>
          </div>
        </section>

        <section className="console-panel scan-host-panel">
          <h2 className="section-title">Hosts</h2>
          <div className="scan-host-list">
            {hosts.map((host) => {
              const open = expandedHosts.has(host.id);
              const portSummary = host.ports.map((port) => `${port.port}/${port.protocol} ${port.service || port.state}`).join(", ") || "no ports";
              return (
                <div className={open ? "scan-host is-open" : "scan-host"} key={host.id}>
                  <button className="scan-host-head" type="button" aria-expanded={open} onClick={() => toggleHost(host.id)}>
                    <ChevronRight className="scan-host-chevron" size={15} aria-hidden="true" />
                    <span className="scan-host-platform" aria-hidden="true">{platformIcon(host)}</span>
                    <span className="scan-host-address">
                      <strong>{host.address}</strong>
                      <span className="status-text">{host.hostname ?? "no hostname"}</span>
                    </span>
                    <span className={`status-dot ${host.status === "up" ? "status-dot-verified" : "status-dot-untested"}`} aria-hidden="true" />
                    <span className="scan-host-services status-text">{portSummary}</span>
                  </button>
                  {open ? (
                    <div className="scan-host-detail">
                      <div className="scan-port-head">
                        <span>Port</span>
                        <span>State</span>
                        <span>Service</span>
                        <span>Ring</span>
                      </div>
                      {host.ports.map((port) => (
                        <div className="scan-port-row" key={`${host.id}-${port.port}-${port.protocol}`}>
                          <span className="mono-cell">{port.port}/{port.protocol}</span>
                          <span>{port.state}</span>
                          <span>{port.service || "unknown"}</span>
                          <span className="status-text">ring {host.hopDistance}</span>
                        </div>
                      ))}
                      {host.ports.length === 0 ? <p className="status-text">No open ports parsed.</p> : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {hosts.length === 0 ? <p className="status-text">No parsed hosts yet.</p> : null}
          </div>
        </section>

        <section className="console-panel scan-output-panel">
          <h2 className="section-title">Output</h2>
          <pre className="tools-output">{output || "No scan output captured yet."}</pre>
        </section>
      </div>
      {loadingLabel ? <div className="route-loading" role="status">{loadingLabel}</div> : null}
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

/** A readable nmap-style command preview for the topology terminal header. The
 * real scan argv is fixed in main; this only mirrors the chosen options. */
function buildScanCommand(target: string, options: ScanOptions): string {
  const typeFlag: Record<ScanType, string> = {
    "ping-sweep": "-sn",
    "quick-top-100": "--top-ports 100",
    "full-tcp": "-p-",
    "service-version": "-sV",
    "os-detect": "-O",
    "vuln-nse": "--script vuln",
    custom: options.customArgs.join(" ")
  };
  const parts = ["nmap", `-${options.timing}`, typeFlag[options.scanType]];
  if (options.ports) {
    parts.push(`-p ${options.ports}`);
  }
  if (options.skipHostDiscovery) {
    parts.push("-Pn");
  }
  if (options.serviceVersion) {
    parts.push("-sV");
  }
  if (options.osDetect) {
    parts.push("-O");
  }
  if (options.vulnScripts) {
    parts.push("--script vuln");
  }
  parts.push(target || "<target>");
  return parts.filter(Boolean).join(" ");
}

/** Infer a device glyph from a host's services so the row reads at a glance. */
function platformIcon(host: ScanHost): ReactNode {
  const services = host.ports.map((port) => port.service).join(" ").toLowerCase();
  if (/microsoft|netbios|msrpc|ms-wbt|smb|rdp/.test(services)) {
    return <Monitor size={16} />;
  }
  return <Server size={16} />;
}

function toFlow(topology: ScanTopology | null): { readonly nodes: Node[]; readonly edges: Edge[] } {
  if (!topology) {
    return { nodes: [], edges: [] };
  }
  return {
    nodes: topology.nodes.map((node) => ({
      id: node.id,
      position: { x: node.x, y: node.y },
      data: { label: node.label },
      // ring 0 is the scan target at the hub; outer rings are discovered hosts.
      className: node.ring === 0 ? "scan-node scan-node-target" : "scan-node"
    })),
    edges: topology.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      animated: true,
      type: "straight"
    }))
  };
}
