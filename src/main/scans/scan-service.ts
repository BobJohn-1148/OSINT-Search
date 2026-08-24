/**
 * Scan service keeps nmap execution in main so active network scanning cannot be
 * triggered by renderer command strings. If scan options became shell text in
 * the UI, exact-target authorization and reportable parsed hosts would both be
 * bypassable.
 */
import type { AuditRepository } from "../../db/repositories/audit-repository.js";
import type { ScansRepository } from "../../db/repositories/scans-repository.js";
import type { ToolsRepository } from "../../db/repositories/tools-repository.js";
import type { ScanHost, ScanOptions, ScanOutputEvent, ScanRunRequest, ScanTopology } from "../../shared/schemas/scans.js";
import type { WslRunResult } from "../tools/wsl-launcher.js";
import { parseNmapXml, toPortsByAddress, toRepositoryHosts } from "./nmap-parser.js";
import { buildScanTopology } from "./topology-layout.js";

export class ScanService {
  public constructor(
    private readonly scansRepository: ScansRepository,
    private readonly toolsRepository: ToolsRepository,
    private readonly auditRepository: AuditRepository,
    private readonly launcher: ScanLauncher,
    private readonly emitOutput: (event: ScanOutputEvent) => void
  ) {}

  public async run(request: ScanRunRequest): Promise<{ readonly scan: ReturnType<ScansRepository["createRun"]>; readonly hosts: ScanHost[]; readonly topology: ScanTopology }> {
    const authorization = this.toolsRepository.findMatchingAuthorization({
      target: request.target,
      tier: "active",
      nowTs: new Date().toISOString()
    });
    const argv = buildNmapArgv(request.target, request.options);
    if (!authorization) {
      const blocked = this.scansRepository.createRun({
        target: request.target,
        wslDistro: request.wslDistro,
        options: request.options,
        argv,
        status: "blocked"
      });
      const finished = this.scansRepository.finishRun({
        scanId: blocked.id,
        status: "blocked",
        stdout: "",
        stderr: "Active scan blocked because no exact unexpired authorization exists for this target.",
        hosts: [],
        portsByAddress: new Map()
      });
      this.auditRepository.record({
        actor: "local-user",
        action: "scan.run.blocked",
        objectType: "scan",
        objectId: blocked.id,
        sensitivity: "medium",
        detail: { target: request.target, scanType: request.options.scanType }
      });
      return { ...finished, topology: buildScanTopology(blocked.id, request.target, []) };
    }

    const started = this.scansRepository.createRun({
      target: request.target,
      wslDistro: request.wslDistro,
      options: request.options,
      argv,
      status: "running",
      authorizationId: authorization.id
    });
    this.auditRepository.record({
      actor: "local-user",
      action: "scan.run",
      objectType: "scan",
      objectId: started.id,
      sensitivity: "medium",
      detail: { target: request.target, scanType: request.options.scanType, timing: request.options.timing }
    });

    const result = await this.launcher.run({
      runId: started.id,
      wslDistro: request.wslDistro,
      argv,
      onOutput: (event) => this.emitOutput({ scanId: started.id, stream: event.stream, chunk: event.chunk })
    });
    // A large scan (full-tcp, vuln-nse across a subnet) can produce more XML
    // than the launcher's 5MB capture cap keeps; the cap keeps the *trailing*
    // bytes, so truncated output has lost its opening tag and is no longer a
    // well-formed document. Parsing it anyway threw uncaught (the same
    // "addChild"-class crash the EVTX parser had) on a scan that actually
    // succeeded, and because that throw happened before finishRun, the row
    // was left at status "running" forever with the real result discarded.
    // Both failure modes -- known truncation and any other parse surprise --
    // now always reach finishRun with a clear failed status instead.
    let parsedHosts: ReturnType<typeof parseNmapXml> = [];
    let parseError: string | null = null;
    if (result.exitCode === 0) {
      if (result.stdoutTruncated) {
        parseError = "nmap output exceeded the 5MB capture limit and was truncated -- results are incomplete and were not parsed. Narrow the scan (fewer ports/hosts, or drop --script vuln) and re-run.";
      } else {
        try {
          parsedHosts = parseNmapXml(result.stdout);
        } catch (error) {
          parseError = `Could not parse nmap output: ${error instanceof Error ? error.message : "unknown parse error"}`;
        }
      }
    }
    const finished = this.scansRepository.finishRun({
      scanId: started.id,
      status: result.exitCode === 0 && !parseError ? "succeeded" : "failed",
      stdout: result.stdout,
      stderr: parseError ? appendStderr(result.stderr, parseError) : result.stderr,
      hosts: toRepositoryHosts(parsedHosts),
      portsByAddress: toPortsByAddress(parsedHosts)
    });
    return {
      ...finished,
      topology: buildScanTopology(started.id, request.target, finished.hosts)
    };
  }

  public get(scanId: string): { readonly scan: ReturnType<ScansRepository["get"]>["scan"]; readonly hosts: ScanHost[] } {
    return this.scansRepository.get(scanId);
  }

  public topology(scanId: string): ScanTopology {
    const bundle = this.scansRepository.get(scanId);
    if (!bundle.scan) {
      throw new Error(`Scan ${scanId} does not exist`);
    }
    return buildScanTopology(scanId, bundle.scan.target, bundle.hosts);
  }
}

export interface ScanLauncher {
  run(input: {
    readonly runId: string;
    readonly wslDistro: string;
    readonly argv: readonly string[];
    readonly onOutput?: (event: { readonly stream: "stdout" | "stderr"; readonly chunk: string }) => void;
  }): Promise<WslRunResult>;
}

export function buildNmapArgv(target: string, options: ScanOptions): string[] {
  const argv = ["nmap", "-oX", "-", `-${options.timing}`];
  if (options.skipHostDiscovery || options.scanType === "ping-sweep") {
    argv.push("-sn");
  }
  if (options.scanType === "quick-top-100") {
    argv.push("--top-ports", "100");
  }
  if (options.scanType === "full-tcp") {
    argv.push("-p", "1-65535");
  }
  if (options.ports) {
    argv.push("-p", options.ports);
  }
  if (options.serviceVersion || options.scanType === "service-version") {
    argv.push("-sV");
  }
  if (options.osDetect || options.scanType === "os-detect") {
    argv.push("-O");
  }
  if (options.vulnScripts || options.scanType === "vuln-nse") {
    argv.push("--script", "vuln");
  }
  if (options.scanType === "custom") {
    argv.push(...validateCustomArgs(options.customArgs));
  }
  argv.push(target);
  return argv;
}

function appendStderr(stderr: string, message: string): string {
  return stderr ? `${stderr}\n${message}` : message;
}

function validateCustomArgs(customArgs: readonly string[]): readonly string[] {
  const safeFlags = new Set(["--reason", "--packet-trace", "--traceroute", "--open", "-v", "-vv"]);
  for (const customArg of customArgs) {
    if (!safeFlags.has(customArg)) {
      throw new Error("Custom nmap argv may only contain approved target-neutral flags; targets must use the authorized target field.");
    }
  }
  return customArgs;
}
