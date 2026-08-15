/**
 * Analyzer service tests use real SQLite with fake adapters because Phase 9 is
 * about main-process policy, persistence, and save-to-case behavior. If these
 * used mocked repositories, imports could pass while evidence rows never landed.
 */
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import Database from "better-sqlite3";
import type { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from "node:child_process";
import { runMigrations } from "../../src/db/migrations/runner";
import { AnalyzersRepository } from "../../src/db/repositories/analyzers-repository";
import { AuditRepository } from "../../src/db/repositories/audit-repository";
import { CasesRepository } from "../../src/db/repositories/cases-repository";
import { AnalyzersService, runFixedProcess } from "../../src/main/analyzers/analyzers-service";
import type { WslRunResult } from "../../src/main/tools/wsl-launcher";

const evtxXml = `
<Event>
  <System>
    <Provider Name="Microsoft-Windows-Security-Auditing"/>
    <EventID>4624</EventID>
    <Level>4</Level>
    <TimeCreated SystemTime="2026-08-10T10:00:00.000Z"/>
  </System>
  <RenderingInfo>
    <Message>An account was successfully logged on.</Message>
  </RenderingInfo>
</Event>`;

const tsharkJson = JSON.stringify([
  {
    _source: {
      layers: {
        "ip.src": "10.0.0.5",
        "ip.dst": "10.0.0.10",
        "_ws.col.Protocol": "DNS",
        "frame.len": "90"
      }
    }
  }
]);

function createHarness() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  const casesRepository = new CasesRepository(db);
  const analyzersRepository = new AnalyzersRepository(db);
  const auditRepository = new AuditRepository(db);
  const spawnCalls: { readonly command: string; readonly args: readonly string[]; readonly options: SpawnOptionsWithoutStdio }[] = [];
  const launcherCalls: readonly string[][] = [];
  const spawnProcess = (command: string, args: readonly string[], options: SpawnOptionsWithoutStdio & { readonly shell: false }) => {
    spawnCalls.push({ command, args, options });
    return fixedProcess(evtxXml);
  };
  const launcher = {
    run: (input: { readonly argv: readonly string[] }): Promise<WslRunResult> => {
      (launcherCalls as string[][]).push([...input.argv]);
      return Promise.resolve({ stdout: tsharkJson, stderr: "", exitCode: 0 });
    }
  };
  const fetchJson = vi.fn().mockImplementation((url: string) => {
    if (url.includes("services.nvd.nist.gov")) {
      return Promise.resolve({
        vulnerabilities: [
          {
            cve: {
              id: "CVE-2026-0001",
              published: "2026-08-10T10:00:00.000",
              descriptions: [{ lang: "en", value: "Example analyzer CVE." }],
              metrics: { cvssMetricV31: [{ baseSeverity: "MEDIUM", cvssData: { baseSeverity: "MEDIUM" } }] }
            }
          }
        ]
      });
    }
    return Promise.resolve("Fallback Vendor");
  });
  const service = new AnalyzersService(analyzersRepository, casesRepository, auditRepository, launcher, spawnProcess, fetchJson);
  return { db, analyzersRepository, auditRepository, casesRepository, fetchJson, launcherCalls, service, spawnCalls };
}

it("analyzers import parse and save findings to a case so every Phase 9 tool produces evidence", async () => {
  const harness = createHarness();
  const caseRecord = harness.casesRepository.create("Analyzer case", []);

  await harness.service.importEvtx({ filePath: "C:\\logs\\security.evtx", caseId: caseRecord.id, eventId: 4624 });
  await harness.service.importPcap({ filePath: "/mnt/c/captures/sample.pcapng", wslDistro: "Ubuntu", caseId: caseRecord.id });
  harness.service.buildDorks({ target: "example.com", caseId: caseRecord.id });
  await harness.service.lookupMac({ mac: "00:16:3e:00:00:01", caseId: caseRecord.id });
  await harness.service.lookupVulnerabilities({ product: "nginx", version: "1.25", caseId: caseRecord.id });

  expect(harness.spawnCalls[0]).toEqual({
    command: "wevtutil.exe",
    args: ["qe", "C:\\logs\\security.evtx", "/lf:true", "/f:xml"],
    options: { shell: false }
  });
  expect(harness.launcherCalls[0]).toEqual(["tshark", "-r", "/mnt/c/captures/sample.pcapng", "-T", "json"]);
  const timeline = harness.casesRepository.timeline(caseRecord.id);
  expect(timeline.map((item) => item.metadata.analyzer).sort()).toEqual([
    "dork",
    "dork",
    "dork",
    "dork",
    "evtx",
    "dork",
    "mac",
    "pcap",
    "vulnerability"
  ].sort());
  expect(timeline.every((item) => item.itemType === "observation")).toBe(true);
});

it("vulnerability lookup caches NVD responses so repeated product and version lookups avoid duplicate network fetches", async () => {
  const harness = createHarness();

  const first = await harness.service.lookupVulnerabilities({ product: "nginx", version: "1.25" });
  const second = await harness.service.lookupVulnerabilities({ product: "nginx", version: "1.25" });

  expect(first.cached).toBe(false);
  expect(second.cached).toBe(true);
  expect(second.vulnerabilities).toEqual(first.vulnerabilities);
  expect(harness.fetchJson).toHaveBeenCalledTimes(1);
  expect(harness.analyzersRepository.readVulnCache("nginx|1.25")).toEqual(first.vulnerabilities);
});

it("EVTX fixed process caps output and times out with a process-tree kill so large logs cannot exhaust memory", async () => {
  const killedPids: number[] = [];
  const kill = vi.fn();
  const spawnProcess = () => {
    const child = new EventEmitter() as ChildProcessWithoutNullStreams;
    Object.assign(child, {
      pid: 12_345,
      stdin: new PassThrough(),
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      kill
    });
    queueMicrotask(() => {
      child.stdout.emit("data", Buffer.alloc(6 * 1024 * 1024, "a"));
    });
    return child;
  };

  const result = await runFixedProcess(spawnProcess, "wevtutil.exe", ["qe", "Security.evtx"], (pid) => killedPids.push(pid), 5);

  expect(Buffer.byteLength(result.stdout, "utf8")).toBeLessThanOrEqual(5 * 1024 * 1024);
  expect(result.stderr).toContain("Process timed out and was canceled.");
  expect(result.exitCode).toBe(1);
  expect(killedPids).toEqual([12_345]);
  expect(kill).toHaveBeenCalled();
});

it("vulnerability lookup rejects invalid NVD responses without caching them so API failures do not become empty results", async () => {
  const harness = createHarness();
  harness.fetchJson.mockResolvedValueOnce("Request Rejected");

  await expect(harness.service.lookupVulnerabilities({ product: "nginx", version: "1.25" })).rejects.toThrow(
    /NVD response missing vulnerabilities/
  );

  expect(harness.analyzersRepository.readVulnCache("nginx|1.25")).toBeNull();
});

function fixedProcess(stdoutText: string): ChildProcessWithoutNullStreams {
  const child = new EventEmitter() as ChildProcessWithoutNullStreams;
  Object.assign(child, {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: vi.fn()
  });
  queueMicrotask(() => {
    child.stdout.emit("data", Buffer.from(stdoutText, "utf8"));
    child.emit("close", 0);
  });
  return child;
}
