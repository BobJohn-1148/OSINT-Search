/**
 * Scan service keeps nmap execution in main so active network scanning cannot be
 * triggered by renderer command strings. The renderer sends typed options, main
 * resolves the local Windows nmap binary, and parsed hosts drive topology/report
 * output from one durable record.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import type { AuditRepository } from "../../db/repositories/audit-repository.js";
import type { ScansRepository } from "../../db/repositories/scans-repository.js";
import type { ScanHost, ScanOptions, ScanOutputEvent, ScanRunRequest, ScanTopology } from "../../shared/schemas/scans.js";
import { parseNmapXml, toPortsByAddress, toRepositoryHosts } from "./nmap-parser.js";
import { buildScanTopology } from "./topology-layout.js";

export class ScanService {
  public constructor(
    private readonly scansRepository: ScansRepository,
    private readonly auditRepository: AuditRepository,
    private readonly emitOutput: (event: ScanOutputEvent) => void,
    private readonly launcher: ScanLauncher = new LocalNmapLauncher()
  ) {}

  public async run(request: ScanRunRequest): Promise<{ readonly scan: ReturnType<ScansRepository["createRun"]>; readonly hosts: ScanHost[]; readonly topology: ScanTopology }> {
    const argv = buildNmapArgv(request.target, request.options);

    const started = this.scansRepository.createRun({
      target: request.target,
      wslDistro: "Local Windows nmap",
      options: request.options,
      argv,
      status: "running",
      authorizationId: null
    });
    this.auditRepository.record({
      actor: "local-user",
      action: "scan.run",
      objectType: "scan",
      objectId: started.id,
      sensitivity: "medium",
      detail: { target: request.target, scanType: request.options.scanType, runner: "local-nmap" }
    });

    const result = await this.launcher.run({
      runId: started.id,
      argv,
      onOutput: (event) => this.emitOutput({ scanId: started.id, stream: event.stream, chunk: event.chunk })
    });
    const parsedHosts = result.exitCode === 0 ? parseNmapXml(result.stdout) : [];
    const finished = this.scansRepository.finishRun({
      scanId: started.id,
      status: result.exitCode === 0 ? "succeeded" : "failed",
      stdout: result.stdout,
      stderr: result.stderr,
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
    readonly argv: readonly string[];
    readonly onOutput?: (event: { readonly stream: "stdout" | "stderr"; readonly chunk: string }) => void;
  }): Promise<ScanRunResult>;
}

export interface ScanRunResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export class LocalNmapLauncher implements ScanLauncher {
  public run(input: {
    readonly runId: string;
    readonly argv: readonly string[];
    readonly onOutput?: (event: { readonly stream: "stdout" | "stderr"; readonly chunk: string }) => void;
  }): Promise<ScanRunResult> {
    const [displayCommand = "nmap", ...args] = input.argv;
    const command = resolveLocalNmapCommand(displayCommand);
    return new Promise((resolve) => {
      let stdout = "";
      let stderr = "";
      let settled = false;
      const finish = (result: ScanRunResult): void => {
        if (!settled) {
          settled = true;
          resolve(result);
        }
      };
      const child = spawn(command, args, { shell: false, windowsHide: true });
      const timeout = setTimeout(() => {
        stderr += "\nScan stopped after 10 minutes. Try a narrower target or a lighter scan type.";
        input.onOutput?.({ stream: "stderr", chunk: "\nScan stopped after 10 minutes. Try a narrower target or a lighter scan type." });
        child.kill();
        finish({ stdout, stderr, exitCode: 124 });
      }, 600_000);

      child.stdout.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        stdout += text;
        input.onOutput?.({ stream: "stdout", chunk: text });
      });
      child.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        stderr += text;
        input.onOutput?.({ stream: "stderr", chunk: text });
      });
      child.on("error", (error) => {
        clearTimeout(timeout);
        const message = `Local nmap launch failed: ${error.message}`;
        stderr += message;
        input.onOutput?.({ stream: "stderr", chunk: message });
        finish({ stdout, stderr, exitCode: 1 });
      });
      child.on("close", (exitCode) => {
        clearTimeout(timeout);
        finish({ stdout, stderr, exitCode: exitCode ?? 1 });
      });
    });
  }
}

export function buildNmapArgv(target: string, options: ScanOptions): string[] {
  const argv = ["nmap", "-oX", "-"];
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

export function resolveLocalNmapCommand(displayCommand = "nmap"): string {
  const explicit = process.env.REACHER_NMAP_PATH ?? process.env.NMAP_PATH;
  const candidates = [
    explicit,
    process.env.ProgramFiles ? `${process.env.ProgramFiles}\\Nmap\\nmap.exe` : undefined,
    process.env["ProgramFiles(x86)"] ? `${process.env["ProgramFiles(x86)"]}\\Nmap\\nmap.exe` : undefined,
    "C:\\Program Files\\Nmap\\nmap.exe",
    "C:\\Program Files (x86)\\Nmap\\nmap.exe"
  ].filter((candidate): candidate is string => Boolean(candidate));
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return displayCommand;
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
