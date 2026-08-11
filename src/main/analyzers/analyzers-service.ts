/**
 * Analyzer orchestration stays in main so file imports, WSL tools, API lookups,
 * audit rows, and save-to-case all share one policy boundary. If analyzer routes
 * performed imports directly, PCAP live capture or arbitrary local process use
 * could creep in through the renderer.
 */
import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from "node:child_process";
import type { Readable } from "node:stream";
import type { AnalyzersRepository } from "../../db/repositories/analyzers-repository.js";
import type { AuditRepository } from "../../db/repositories/audit-repository.js";
import type { CasesRepository } from "../../db/repositories/cases-repository.js";
import type {
  AnalyzerDorkBuildRequest,
  AnalyzerEvtxImportRequest,
  AnalyzerFinding,
  AnalyzerMacLookupRequest,
  AnalyzerPcapImportRequest,
  AnalyzerVulnLookupRequest,
  EvtxEvent,
  PcapConversation
} from "../../shared/schemas/analyzers.js";
import { killWindowsProcessTree, type WslRunResult } from "../tools/wsl-launcher.js";
import { buildDorks } from "./dork-builder.js";
import { filterEvtxEvents, parseEvtxXml } from "./evtx-parser.js";
import { lookupMacVendor } from "./mac-lookup.js";
import { buildTsharkArgv, parseTsharkJson } from "./pcap-parser.js";
import { fetchNvdVulnerabilities, vulnCacheKey } from "./vulnerability-lookup.js";

const MAX_EVTX_CAPTURE_BYTES = 5 * 1024 * 1024;
const EVTX_BACKPRESSURE_HIGH_WATER_BYTES = 512 * 1024;
const DEFAULT_EVTX_PROCESS_TIMEOUT_MS = 60_000;

export interface AnalyzerLauncher {
  run(input: {
    readonly runId: string;
    readonly wslDistro: string;
    readonly argv: readonly string[];
  }): Promise<WslRunResult>;
}

export type SpawnAnalyzerProcess = (
  command: string,
  args: readonly string[],
  options: SpawnOptionsWithoutStdio & { readonly shell: false }
) => ChildProcessWithoutNullStreams;
export type KillAnalyzerProcessTree = (pid: number) => void;

export type JsonFetcher = (url: string) => Promise<unknown>;

export class AnalyzersService {
  public constructor(
    private readonly analyzersRepository: AnalyzersRepository,
    private readonly casesRepository: CasesRepository,
    private readonly auditRepository: AuditRepository,
    private readonly launcher: AnalyzerLauncher,
    private readonly spawnProcess: SpawnAnalyzerProcess = spawn,
    private readonly fetchJson: JsonFetcher = defaultFetchJson
  ) {}

  public async importEvtx(request: AnalyzerEvtxImportRequest) {
    const result = await runFixedProcess(this.spawnProcess, "wevtutil.exe", ["qe", request.filePath, "/lf:true", "/f:xml"]);
    if (result.exitCode !== 0) {
      throw new Error(result.stderr || "wevtutil failed to import the event log");
    }
    const events = filterEvtxEvents(parseEvtxXml(result.stdout), request);
    const importId = this.analyzersRepository.recordEvtxImport(request.filePath, events.length);
    const findings = events.map((event) => evtxFinding(importId, event, request.filePath));
    this.saveFindings(request.caseId, findings);
    this.auditRepository.record({
      actor: "local-user",
      action: "analyzer.evtx.import",
      objectType: "evtx_import",
      objectId: importId,
      sensitivity: "medium",
      detail: { filePath: request.filePath, count: events.length }
    });
    return { importId, events, findings };
  }

  public async importPcap(request: AnalyzerPcapImportRequest) {
    const argv = buildTsharkArgv(request.filePath);
    const result = await this.launcher.run({ runId: `pcap:${request.filePath}`, wslDistro: request.wslDistro, argv });
    if (result.exitCode !== 0) {
      throw new Error(result.stderr || "tshark failed to import the capture file");
    }
    const conversations = parseTsharkJson(result.stdout);
    const importId = this.analyzersRepository.recordPcapImport(request.filePath, conversations.length);
    const findings = conversations.map((conversation) => pcapFinding(importId, conversation, request.filePath));
    this.saveFindings(request.caseId, findings);
    this.auditRepository.record({
      actor: "local-user",
      action: "analyzer.pcap.import",
      objectType: "pcap_import",
      objectId: importId,
      sensitivity: "medium",
      detail: { filePath: request.filePath, count: conversations.length }
    });
    return { importId, conversations, findings };
  }

  public buildDorks(request: AnalyzerDorkBuildRequest) {
    const dorks = buildDorks(request.target);
    const findings = dorks.map((dork) => finding("dork", "dork", dork.label, dork.query, "google-dork", "low", { target: request.target }));
    this.saveFindings(request.caseId, findings);
    this.auditRepository.record({
      actor: "local-user",
      action: "analyzer.dork.build",
      objectType: "analyzer_dork",
      objectId: request.target,
      sensitivity: "low",
      detail: { target: request.target, count: dorks.length }
    });
    return { dorks, findings };
  }

  public async lookupMac(request: AnalyzerMacLookupRequest) {
    const result = await lookupMacVendor(request.mac, async (oui) => {
      const value = await this.fetchJson(`https://api.macvendors.com/${oui}`);
      return typeof value === "string" ? value : null;
    });
    const findings = [finding("mac", "mac", `Vendor for ${request.mac}`, result.vendor, result.source, "low", result)];
    this.saveFindings(request.caseId, findings);
    this.auditRepository.record({
      actor: "local-user",
      action: "analyzer.mac.lookup",
      objectType: "analyzer_mac",
      objectId: result.oui,
      sensitivity: "low",
      detail: { mac: result.mac, oui: result.oui, source: result.source }
    });
    return { result, findings };
  }

  public async lookupVulnerabilities(request: AnalyzerVulnLookupRequest) {
    const cacheKey = vulnCacheKey(request.product, request.version);
    const cached = this.analyzersRepository.readVulnCache(cacheKey);
    const vulnerabilities = cached ?? await fetchNvdVulnerabilities({
      product: request.product,
      version: request.version,
      fetchJson: (query) =>
        this.fetchJson(`https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=${encodeURIComponent(query)}`)
    });
    if (!cached) {
      this.analyzersRepository.writeVulnCache({
        cacheKey,
        product: request.product,
        version: request.version,
        vulnerabilities
      });
    }
    const findings = vulnerabilities.map((vulnerability) =>
      finding("vulnerability", "vulnerability", vulnerability.id, vulnerability.summary, vulnerability.url, vulnerability.severity, vulnerability)
    );
    this.saveFindings(request.caseId, findings);
    this.auditRepository.record({
      actor: "local-user",
      action: "analyzer.vulnerability.lookup",
      objectType: "analyzer_vulnerability",
      objectId: cacheKey,
      sensitivity: "medium",
      detail: { product: request.product, version: request.version ?? null, count: vulnerabilities.length, cached: Boolean(cached) }
    });
    return { vulnerabilities, findings, cached: Boolean(cached) };
  }

  private saveFindings(caseId: string | undefined, findings: readonly AnalyzerFinding[]): void {
    if (!caseId) {
      return;
    }
    for (const item of findings) {
      this.casesRepository.addItem({
        caseId,
        itemType: "observation",
        refId: item.id,
        title: item.title,
        text: item.text,
        metadata: { ...item.metadata, analyzer: item.analyzer, findingType: item.type, sourceId: item.source, entity: item.title, strength: 1 }
      });
    }
  }
}

export function runFixedProcess(
  spawnProcess: SpawnAnalyzerProcess,
  command: string,
  args: readonly string[],
  killProcessTree: KillAnalyzerProcessTree = killWindowsProcessTree,
  processTimeoutMs = DEFAULT_EVTX_PROCESS_TIMEOUT_MS
): Promise<WslRunResult> {
  return new Promise((resolve) => {
    let settled = false;
    let stdout = "";
    let stderr = "";
    const child = spawnProcess(command, args, { shell: false });
    child.stdout.pause();
    child.stderr.pause();
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const settle = (exitCode: number, finalStdout: string, finalStderr: string, killTree: boolean): void => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      if (killTree) {
        terminateProcessTree(child, killProcessTree);
      }
      resolve({ stdout: finalStdout, stderr: finalStderr, exitCode });
    };
    timeout = setTimeout(() => {
      settle(1, stdout, appendCapped(stderr, "Process timed out and was canceled."), true);
    }, processTimeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      stdout = appendCapped(stdout, chunk.toString("utf8"));
      applyBackpressure(child.stdout, stdout);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = appendCapped(stderr, chunk.toString("utf8"));
      applyBackpressure(child.stderr, stderr);
    });
    child.on("error", (error) => {
      settle(1, stdout, appendCapped(stderr, error.message), false);
    });
    child.on("close", (code) => {
      settle(code ?? 1, stdout, stderr, false);
    });
    child.stdout.resume();
    child.stderr.resume();
  });
}

function evtxFinding(importId: string, event: EvtxEvent, filePath: string): AnalyzerFinding {
  return finding(
    "evtx",
    "event",
    `${event.provider} ${event.eventId}`,
    event.message || `${event.level} event ${event.eventId}`,
    filePath,
    event.level,
    { importId, eventId: event.eventId, provider: event.provider, timestamp: event.timestamp }
  );
}

function pcapFinding(importId: string, conversation: PcapConversation, filePath: string): AnalyzerFinding {
  return finding(
    "pcap",
    "packet",
    `${conversation.source} to ${conversation.destination}`,
    `${conversation.protocol} packets:${conversation.packets} bytes:${conversation.bytes}`,
    filePath,
    "low",
    { importId, ...conversation }
  );
}

function finding(
  analyzer: string,
  type: AnalyzerFinding["type"],
  title: string,
  text: string,
  source: string,
  severity: string,
  metadata: Record<string, unknown>
): AnalyzerFinding {
  return {
    id: `${analyzer}:${Buffer.from(`${title}:${text}`).toString("base64url").slice(0, 16)}`,
    analyzer,
    type,
    title,
    text,
    source,
    severity,
    metadata
  };
}

async function defaultFetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function appendCapped(existing: string, chunk: string, maxBytes = MAX_EVTX_CAPTURE_BYTES): string {
  const combined = existing + chunk;
  if (Buffer.byteLength(combined, "utf8") <= maxBytes) {
    return combined;
  }
  let capped = Buffer.from(combined, "utf8").subarray(-maxBytes).toString("utf8");
  while (Buffer.byteLength(capped, "utf8") > maxBytes) {
    capped = capped.slice(1);
  }
  return capped;
}

function applyBackpressure(stream: Readable, captured: string): void {
  if (Buffer.byteLength(captured, "utf8") < EVTX_BACKPRESSURE_HIGH_WATER_BYTES) {
    return;
  }
  stream.pause();
  queueMicrotask(() => stream.resume());
}

function terminateProcessTree(child: ChildProcessWithoutNullStreams, killProcessTree: KillAnalyzerProcessTree): void {
  if (child.pid) {
    killProcessTree(child.pid);
  }
  child.kill();
}
