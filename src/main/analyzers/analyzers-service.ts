/**
 * Analyzer orchestration stays in main so file imports, WSL tools, API lookups,
 * audit rows, and save-to-case all share one policy boundary. If analyzer routes
 * performed imports directly, PCAP live capture or arbitrary local process use
 * could creep in through the renderer.
 */
import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from "node:child_process";
import { open, stat } from "node:fs/promises";
import type { Readable } from "node:stream";
import type { AnalyzersRepository } from "../../db/repositories/analyzers-repository.js";
import type { AuditRepository } from "../../db/repositories/audit-repository.js";
import type { CasesRepository } from "../../db/repositories/cases-repository.js";
import type {
  AnalyzerDorkBuildRequest,
  AnalyzerEmailHeadersRequest,
  AnalyzerEvtxImportRequest,
  AnalyzerFinding,
  AnalyzerMacLookupRequest,
  AnalyzerMalwareTriageRequest,
  AnalyzerPcapImportRequest,
  AnalyzerVirusTotalLookupRequest,
  AnalyzerVulnLookupRequest,
  EvtxEvent,
  PcapConversation
} from "../../shared/schemas/analyzers.js";
import type { KeySource } from "../../shared/types/sources.js";
import { killWindowsProcessTree, type WslRunResult } from "../tools/wsl-launcher.js";
import { buildDorks } from "./dork-builder.js";
import { parseEmailHeaders } from "./email-header-parser.js";
import { filterEvtxEvents, parseEvtxXml } from "./evtx-parser.js";
import { lookupMacVendor } from "./mac-lookup.js";
import { triageBuffer, triageFindings } from "./malware-triage.js";
import { buildTsharkArgv, parseTsharkJson } from "./pcap-parser.js";
import { fetchVirusTotalFileReport } from "./virustotal-lookup.js";
import { fetchNvdVulnerabilities, vulnCacheKey } from "./vulnerability-lookup.js";

const MAX_EVTX_CAPTURE_BYTES = 5 * 1024 * 1024;
const EVTX_BACKPRESSURE_HIGH_WATER_BYTES = 512 * 1024;
const DEFAULT_EVTX_PROCESS_TIMEOUT_MS = 60_000;
// Triage reads the whole sample into memory to hash and walk it, so the read is
// capped: a multi-gigabyte file must not be able to OOM the main process. Beyond
// the cap we read a prefix and mark the report truncated rather than refusing —
// headers, imports, and most config strings live near the front of a binary.
const MAX_TRIAGE_BYTES = 64 * 1024 * 1024;

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

export type JsonFetcher = (url: string, init?: RequestInit) => Promise<unknown>;

export interface AnalyzerVaultReader {
  readSecret(source: KeySource, actor: string, purpose: string): string;
}

export interface AnalyzersServiceOptions {
  readonly spawnProcess?: SpawnAnalyzerProcess;
  readonly fetchJson?: JsonFetcher;
  readonly vaultReader?: AnalyzerVaultReader;
}

export class AnalyzersService {
  private readonly spawnProcess: SpawnAnalyzerProcess;
  private readonly fetchJson: JsonFetcher;
  private readonly vaultReader: AnalyzerVaultReader | undefined;

  public constructor(
    private readonly analyzersRepository: AnalyzersRepository,
    private readonly casesRepository: CasesRepository,
    private readonly auditRepository: AuditRepository,
    private readonly launcher: AnalyzerLauncher,
    options: AnalyzersServiceOptions = {}
  ) {
    this.spawnProcess = options.spawnProcess ?? spawn;
    this.fetchJson = options.fetchJson ?? defaultFetchJson;
    this.vaultReader = options.vaultReader;
  }

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

  public analyzeEmailHeaders(request: AnalyzerEmailHeadersRequest) {
    const report = parseEmailHeaders(request.rawHeaders);
    const severity = report.riskScore >= 60 ? "high" : report.riskScore >= 30 ? "medium" : "low";
    const summary = finding(
      "email",
      "email",
      `Email headers${report.fromDomain ? ` from ${report.fromDomain}` : ""}`,
      [
        `risk:${report.riskScore}/100`,
        `spf:${report.auth.spf}`,
        `dkim:${report.auth.dkim}`,
        `dmarc:${report.auth.dmarc}`,
        `hops:${report.hops.length}`
      ].join(" "),
      report.originatingIp ? `ip:${report.originatingIp}` : "email-headers",
      severity,
      {
        from: report.from,
        subject: report.subject,
        originatingIp: report.originatingIp,
        auth: report.auth,
        riskScore: report.riskScore,
        riskReasons: report.riskReasons,
        spoofingIndicators: report.spoofingIndicators
      }
    );
    const findings: AnalyzerFinding[] = [summary];
    if (report.originatingIp) {
      findings.push(
        finding("email", "ioc", `Originating IP ${report.originatingIp}`, report.originatingHost ?? report.originatingIp, `email:${report.originatingIp}`, severity, {
          value: report.originatingIp,
          seedType: "ip",
          entity: report.originatingIp,
          pivotSeed: { type: "ip", value: report.originatingIp }
        })
      );
    }
    if (report.fromDomain) {
      findings.push(
        finding("email", "ioc", `Sender domain ${report.fromDomain}`, report.from ?? report.fromDomain, `email:${report.fromDomain}`, "low", {
          value: report.fromDomain,
          seedType: "domain",
          entity: report.fromDomain,
          pivotSeed: { type: "domain", value: report.fromDomain }
        })
      );
    }
    this.saveFindings(request.caseId, findings);
    this.auditRepository.record({
      actor: "local-user",
      action: "analyzer.email.headers",
      objectType: "analyzer_email",
      objectId: report.messageId ?? report.originatingIp ?? "email-headers",
      sensitivity: "medium",
      detail: {
        fromDomain: report.fromDomain,
        originatingIp: report.originatingIp,
        riskScore: report.riskScore,
        spf: report.auth.spf,
        dkim: report.auth.dkim,
        dmarc: report.auth.dmarc,
        hops: report.hops.length
      }
    });
    return { report, findings };
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

  public async lookupVirusTotal(request: AnalyzerVirusTotalLookupRequest) {
    if (!this.vaultReader) {
      throw new Error("VirusTotal key storage is not available");
    }
    const apiKey = this.vaultReader.readSecret("virustotal", "local-user", "analyzer.virustotal.lookup");
    const report = await fetchVirusTotalFileReport(request, apiKey, this.fetchJson);
    const stats = report.detectionStats;
    const severity = stats.malicious > 0 ? "high" : stats.suspicious > 0 ? "medium" : "low";
    const summary = [
      `malicious:${stats.malicious}`,
      `suspicious:${stats.suspicious}`,
      `harmless:${stats.harmless}`,
      `undetected:${stats.undetected}`,
      report.threatLabel ? `label:${report.threatLabel}` : null
    ].filter((item): item is string => Boolean(item)).join(" ");
    const findings = [
      finding("virustotal", "file", `VirusTotal ${report.fileName}`, summary, report.guiUrl, severity, {
        sha256: report.sha256,
        sha1: report.sha1,
        md5: report.md5,
        fileSize: report.fileSize,
        typeDescription: report.typeDescription,
        threatLabel: report.threatLabel,
        detectionStats: report.detectionStats,
        topDetections: report.topDetections.slice(0, 8)
      })
    ];
    this.saveFindings(request.caseId, findings);
    this.auditRepository.record({
      actor: "local-user",
      action: "analyzer.virustotal.lookup",
      objectType: "analyzer_virustotal",
      objectId: report.sha256,
      sensitivity: "medium",
      detail: {
        sha256: report.sha256,
        fileName: report.fileName,
        fileSize: report.fileSize,
        malicious: stats.malicious,
        suspicious: stats.suspicious
      }
    });
    return { report, findings };
  }

  public async triageMalware(request: AnalyzerMalwareTriageRequest) {
    const { buffer, declaredSize, truncated } = await readCappedFile(request.filePath, MAX_TRIAGE_BYTES);
    const fileName = baseName(request.filePath);
    const report = triageBuffer({ buffer, fileName, declaredSize, truncated });
    const findings = triageFindings(report);
    this.saveFindings(request.caseId, findings);
    // Sensitivity is "high": handling a suspected-malicious sample is the most
    // sensitive local action in the analyzer set, so the import is always logged
    // with its hash even when nothing is saved to a case.
    this.auditRepository.record({
      actor: "local-user",
      action: "analyzer.malware.triage",
      objectType: "analyzer_malware",
      objectId: report.sha256,
      sensitivity: "high",
      detail: {
        filePath: request.filePath,
        sha256: report.sha256,
        fileSize: report.fileSize,
        fileType: report.fileType,
        riskScore: report.riskScore,
        iocCount: report.iocs.length,
        truncated: report.truncated
      }
    });
    return { report, findings };
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

/**
 * Read at most maxBytes of a file. The sample is opened read-only and a fixed
 * prefix is pulled into one buffer — never streamed to a child process, never
 * executed. Oversized files are truncated (prefix kept) rather than rejected so
 * the header and early config strings still get analyzed.
 */
async function readCappedFile(
  filePath: string,
  maxBytes: number
): Promise<{ readonly buffer: Buffer; readonly declaredSize: number; readonly truncated: boolean }> {
  const stats = await stat(filePath);
  if (!stats.isFile()) {
    throw new Error("Malware triage target is not a file");
  }
  const declaredSize = stats.size;
  const readSize = Math.min(declaredSize, maxBytes);
  const handle = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(readSize);
    if (readSize > 0) {
      await handle.read(buffer, 0, readSize, 0);
    }
    return { buffer, declaredSize, truncated: declaredSize > maxBytes };
  } finally {
    await handle.close();
  }
}

function baseName(filePath: string): string {
  const normalized = filePath.replace(/[\\/]+$/, "");
  const segments = normalized.split(/[\\/]/);
  return segments[segments.length - 1] || filePath;
}

async function defaultFetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(responseErrorMessage(response.status, text));
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function responseErrorMessage(status: number, text: string): string {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed === "object" && parsed !== null && "error" in parsed) {
      const error = (parsed as { readonly error?: { readonly message?: unknown } }).error;
      if (typeof error?.message === "string" && error.message.length > 0) {
        return `Request failed with status ${status}: ${error.message}`;
      }
    }
  } catch {
    // Keep the generic status message when the upstream body is not JSON.
  }
  return `Request failed with status ${status}`;
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
