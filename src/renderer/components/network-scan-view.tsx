/**
 * The Network scan view is a builder over typed scan options, not a command
 * prompt. If it assembled nmap strings directly, renderer text could become
 * extra targets or shell syntax instead of the fixed local nmap argv main owns.
 */
import { FileText, LocateFixed, Play, Terminal } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { ScanHost, ScanOptions, ScanOutputEvent, ScanTopology } from "../../shared/schemas/scans";
import type { ScanType } from "../../shared/types/scans";
import { useReacherClient } from "../hooks/use-reacher-client";

const scanTypes: readonly ScanType[] = ["ping-sweep", "quick-top-100", "full-tcp", "service-version", "os-detect", "vuln-nse", "custom"];

export function NetworkScanView() {
  const { invoke } = useReacherClient();
  const [target, setTarget] = useState("192.168.1.0/24");
  const [scanType, setScanType] = useState<ScanType>("quick-top-100");
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
  const [localNetworks, setLocalNetworks] = useState<readonly { readonly name: string; readonly address: string; readonly cidr: string }[]>([]);
  const liveHosts = useMemo(() => parseLiveNmapHosts(output, scanId || "live-scan"), [output, scanId]);
  const displayedHosts = hosts.length > 0 ? hosts : liveHosts;

  useEffect(() => {
    const unsubscribe = window.reacher.onScanEvent("scan:output", (event: ScanOutputEvent) => {
      setOutput((current) => `${current}${event.chunk}`);
    });
    return unsubscribe;
  }, []);

  const loadLocalNetworks = useCallback(async (): Promise<void> => {
    const result = await invoke("system:localNetworks", {});
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setLocalNetworks(Array.isArray(result.value.networks) ? result.value.networks : []);
  }, [invoke]);

  useEffect(() => {
    let mounted = true;
    void Promise.resolve().then(async () => {
      if (mounted) {
        await loadLocalNetworks();
      }
    });
    return () => {
      mounted = false;
    };
  }, [loadLocalNetworks]);

  const options: ScanOptions = {
    scanType,
    timing: "T3",
    ports: ports || undefined,
    customArgs: customArgs.split(/\s+/).filter(Boolean),
    skipHostDiscovery,
    serviceVersion,
    osDetect,
    vulnScripts
  };

  async function runScan() {
    setOutput("");
    setStatus("Running scan");
    const result = await invoke("scan:run", { target, options });
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setScanId(result.value.scan.id);
    setHosts(result.value.hosts);
    setTopology(result.value.topology);
    setOutput(result.value.scan.stdout || result.value.scan.stderr);
    setStatus(`Scan ${result.value.scan.status}`);
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
        <p className="route-summary">Run local Windows nmap, parse hosts and ports, and render a terminal-style topology map.</p>
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
              Local network
              <select className="field-control" value="" onChange={(event) => event.currentTarget.value && setTarget(event.currentTarget.value)}>
                <option value="">Choose detected CIDR</option>
                {localNetworks.map((network) => (
                  <option key={`${network.name}-${network.address}`} value={network.cidr}>
                    {network.cidr} / {network.name}
                  </option>
                ))}
              </select>
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
            <button className="action-button" type="button" onClick={() => {
              const firstNetwork = firstItem(localNetworks);
              if (firstNetwork) {
                setTarget(firstNetwork.cidr);
                setStatus(`Selected ${firstNetwork.cidr}`);
              } else {
                void loadLocalNetworks();
              }
            }}>
              <LocateFixed size={18} />
              Use local network
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
          <CliTopology topology={topology} hosts={displayedHosts} target={target} status={status} />
        </section>

        <section className="console-panel scan-host-panel">
          <h2 className="section-title">Hosts</h2>
          <div className="table-list">
            {displayedHosts.map((host) => (
              <div key={host.id} className="scan-host-row">
                <strong>{host.address}</strong>
                <span>{host.status}</span>
                <span className="status-text">{host.hostname ?? "no hostname"} / ring:{host.hopDistance}</span>
                <span className="status-text">{host.ports.map((port) => `${port.port}/${port.protocol} ${port.service || port.state}`).join(", ") || "no ports"}</span>
              </div>
            ))}
            {displayedHosts.length === 0 ? <p className="status-text">No parsed hosts yet.</p> : null}
          </div>
        </section>

        <section className="console-panel scan-output-panel">
          <h2 className="section-title">Output</h2>
          <ScanOutputView output={output} hosts={displayedHosts} status={status} />
        </section>
      </div>
    </section>
  );
}

function ScanOutputView(props: { readonly output: string; readonly hosts: readonly ScanHost[]; readonly status: string }) {
  const openPorts = props.hosts.flatMap((host) => host.ports.filter((port) => port.state === "open").map((port) => ({ host, port })));
  if (!props.output.trim()) {
    return <p className="status-text">No scan output captured yet.</p>;
  }
  return (
    <div className="scan-output-formatted">
      <div className="scan-output-summary-grid">
        <MetricCard label="Hosts discovered" value={props.hosts.length.toString()} />
        <MetricCard label="Open ports" value={openPorts.length.toString()} />
        <MetricCard label="Scan state" value={props.status.replace(/^Scan\s+/i, "")} />
      </div>
      {props.hosts.length > 0 ? (
        <div className="scan-output-table" role="table" aria-label="Parsed nmap scan output">
          <div className="scan-output-row scan-output-header" role="row">
            <span role="columnheader">Host</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Hostname</span>
            <span role="columnheader">Ports / services</span>
          </div>
          {props.hosts.map((host) => (
            <div className="scan-output-row" role="row" key={host.id}>
              <span role="cell">{host.address}</span>
              <span role="cell">{host.status}</span>
              <span role="cell">{host.hostname ?? "no hostname"}</span>
              <span role="cell">{host.ports.map((port) => `${port.port}/${port.protocol} ${port.state}${port.service ? ` ${port.service}` : ""}${port.product ? ` ${port.product}` : ""}${port.version ? ` ${port.version}` : ""}`).join(", ") || "no reported ports"}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="status-text">Scan output is present, but no complete host records have been parsed yet.</p>
      )}
      <details className="mobile-raw-toggle">
        <summary>Raw nmap XML / command output</summary>
        <pre className="tools-output">{props.output}</pre>
      </details>
    </div>
  );
}

function MetricCard(props: { readonly label: string; readonly value: string }) {
  return (
    <div className="scan-output-metric">
      <strong>{props.value}</strong>
      <span>{props.label}</span>
    </div>
  );
}

function CliTopology(props: {
  readonly topology: ScanTopology | null;
  readonly hosts: readonly ScanHost[];
  readonly target: string;
  readonly status: string;
}) {
  const model = useMemo(() => toCliTopology(props.topology, props.hosts, props.target), [props.hosts, props.target, props.topology]);
  const openPortCount = props.hosts.reduce((total, host) => total + host.ports.filter((port) => port.state === "open").length, 0);
  const commandPreview = `nmap -oX - ${props.target}`;
  return (
    <div className="scan-cli-topology" aria-label="Scan topology">
      <div className="scan-cli-header">
        <span className="scan-cli-dot" />
        <span className="scan-cli-dot" />
        <span className="scan-cli-dot" />
        <span className="scan-cli-title">
          <Terminal size={14} />
          local-nmap/topology
        </span>
      </div>
      <div className="scan-cli-lines" aria-label="Topology telemetry">
        <span>$ {commandPreview}</span>
        <span>hosts:{props.hosts.length} open_ports:{openPortCount} status:{props.status.toLowerCase().replace(/\s+/g, "-")}</span>
      </div>
      <div className="scan-topology-stage">
        <div className="scan-topology-grid" />
        <div className="scan-topology-floor" />
        {model.edges.map((edge) => (
          <span
            key={edge.id}
            className="scan-cli-edge"
            style={{ left: `${edge.left}%`, top: `${edge.top}%`, width: `${edge.width}%`, transform: `rotate(${edge.angle}deg)` }}
          />
        ))}
        {model.nodes.map((node) => (
          <article
            key={node.id}
            className={`scan-cli-node scan-cli-node-${node.kind}`}
            style={{ "--node-x": `${node.x}%`, "--node-y": `${node.y}%`, "--node-z": `${node.ring * 7}px` } as CSSProperties}
          >
            <span className="scan-cli-node-light" />
            <span className="scan-cli-node-title">{node.label}</span>
            <span className="scan-cli-node-meta">{node.meta}</span>
          </article>
        ))}
        {model.nodes.length === 1 ? <p className="scan-topology-empty">Run a scan to populate discovered hosts.</p> : null}
      </div>
    </div>
  );
}

function firstItem<T>(items: readonly T[]): T | null {
  for (const item of items) {
    return item;
  }
  return null;
}

function Toggle(props: { readonly label: string; readonly checked: boolean; readonly onChange: (checked: boolean) => void }) {
  return (
    <label className="settings-toggle">
      <input type="checkbox" checked={props.checked} onChange={(event) => props.onChange(event.target.checked)} />
      {props.label}
    </label>
  );
}

interface CliNode {
  readonly id: string;
  readonly label: string;
  readonly meta: string;
  readonly x: number;
  readonly y: number;
  readonly ring: number;
  readonly kind: "target" | "host";
}

interface CliEdge {
  readonly id: string;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly angle: number;
}

function toCliTopology(topology: ScanTopology | null, hosts: readonly ScanHost[], target: string): { readonly nodes: CliNode[]; readonly edges: CliEdge[] } {
  const effectiveTopology = topology ?? (hosts.length > 0 ? buildLiveTopology(hosts, target) : null);
  if (!effectiveTopology) {
    return {
      nodes: [{ id: "target", label: target, meta: "awaiting scan", x: 50, y: 52, ring: 0, kind: "target" }],
      edges: []
    };
  }
  const hostById = new Map(hosts.map((host) => [host.id, host]));
  const minX = Math.min(...effectiveTopology.nodes.map((node) => node.x));
  const maxX = Math.max(...effectiveTopology.nodes.map((node) => node.x));
  const minY = Math.min(...effectiveTopology.nodes.map((node) => node.y));
  const maxY = Math.max(...effectiveTopology.nodes.map((node) => node.y));
  const normalize = (value: number, min: number, max: number, low: number, high: number): number => {
    if (min === max) {
      return (low + high) / 2;
    }
    return low + ((value - min) / (max - min)) * (high - low);
  };
  const nodes = effectiveTopology.nodes.map((node): CliNode => {
    const host = hostById.get(node.id);
    const portSummary = host?.ports.length ? `${host.ports.length} ports / ${host.status}` : host?.status ?? "target root";
    return {
      id: node.id,
      label: node.label,
      meta: `ring:${node.ring} ${portSummary}`,
      x: normalize(node.x, minX, maxX, 18, 82),
      y: normalize(node.y, minY, maxY, 24, 76),
      ring: node.ring,
      kind: node.id === "target" ? "target" : "host"
    };
  });
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  return {
    nodes,
    edges: effectiveTopology.edges.flatMap((edge): CliEdge[] => {
      const source = nodeById.get(edge.source);
      const destination = nodeById.get(edge.target);
      if (!source || !destination) {
        return [];
      }
      const dx = destination.x - source.x;
      const dy = destination.y - source.y;
      return [{
        id: edge.id,
        left: source.x,
        top: source.y,
        width: Math.sqrt(dx * dx + dy * dy),
        angle: Math.atan2(dy, dx) * (180 / Math.PI)
      }];
    })
  };
}

function parseLiveNmapHosts(output: string, scanId: string): ScanHost[] {
  const hostBlocks = output.match(/<host\b[\s\S]*?<\/host>/g) ?? [];
  const hosts = hostBlocks
    .map((block) => parseLiveHostBlock(block, scanId))
    .filter((host): host is ScanHost => host !== null);
  return [...new Map(hosts.map((host) => [host.address, host])).values()]
    .sort((left, right) => left.hopDistance - right.hopDistance || left.address.localeCompare(right.address));
}

function parseLiveHostBlock(block: string, scanId: string): ScanHost | null {
  const document = new DOMParser().parseFromString(`<nmaprun>${block}</nmaprun>`, "application/xml");
  if (document.querySelector("parsererror")) {
    return null;
  }
  const host = document.querySelector("host");
  const address = [...document.querySelectorAll("address")]
    .find((node) => node.getAttribute("addrtype") === "ipv4")
    ?.getAttribute("addr") ?? host?.querySelector("address")?.getAttribute("addr");
  if (!address) {
    return null;
  }
  const hostId = `live-${address.replace(/[^A-Za-z0-9_.-]/g, "-")}`;
  return {
    id: hostId,
    scanId,
    address,
    hostname: host?.querySelector("hostnames hostname")?.getAttribute("name") ?? null,
    status: host?.querySelector("status")?.getAttribute("state") ?? "unknown",
    hopDistance: liveHopDistance(host),
    ports: [...document.querySelectorAll("port")].map((port, index) => ({
      id: `${hostId}-port-${index}`,
      scanId,
      hostId,
      protocol: port.getAttribute("protocol") ?? "tcp",
      port: Number(port.getAttribute("portid") ?? "0"),
      state: port.querySelector("state")?.getAttribute("state") ?? "unknown",
      service: port.querySelector("service")?.getAttribute("name") ?? "",
      product: port.querySelector("service")?.getAttribute("product") ?? "",
      version: port.querySelector("service")?.getAttribute("version") ?? ""
    }))
  };
}

function liveHopDistance(host: Element | null): number {
  const hops = [...(host?.querySelectorAll("trace hop") ?? [])];
  const ttls = hops
    .map((hop) => Number(hop.getAttribute("ttl") ?? "0"))
    .filter((ttl) => Number.isFinite(ttl) && ttl > 0);
  if (ttls.length > 0) {
    return Math.max(...ttls);
  }
  return Math.max(1, hops.length || 1);
}

function buildLiveTopology(hosts: readonly ScanHost[], target: string): ScanTopology {
  return {
    scanId: "live",
    nodes: [
      { id: "target", label: target, x: 0, y: 0, ring: 0 },
      ...hosts.map((host) => {
        const ring = Math.max(1, host.hopDistance);
        const angle = (hashAddress(host.address) % 360) * (Math.PI / 180);
        const radius = ring * 170;
        return {
          id: host.id,
          label: host.hostname ? `${host.hostname} (${host.address})` : host.address,
          x: Math.round(Math.cos(angle) * radius),
          y: Math.round(Math.sin(angle) * radius),
          ring
        };
      })
    ],
    edges: hosts.map((host) => ({ id: `target-${host.id}`, source: "target", target: host.id }))
  };
}

function hashAddress(address: string): number {
  let hash = 2166136261;
  for (const character of address) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
