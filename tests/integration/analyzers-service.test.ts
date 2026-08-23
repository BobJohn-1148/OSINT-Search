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
  const fetchJson = vi.fn((...args: [string, RequestInit?]): Promise<unknown> => {
    const [url] = args;
    if (url.includes("virustotal.com/api/v3/files")) {
      return Promise.resolve({
        data: {
          id: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
          links: { self: "https://www.virustotal.com/api/v3/files/2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824" },
          attributes: {
            sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
            sha1: "aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d",
            md5: "5d41402abc4b2a76b9719d911017c592",
            size: 5,
            type_description: "Text",
            meaningful_name: "hello.txt",
            reputation: -4,
            first_submission_date: 1_787_829_600,
            last_analysis_date: 1_787_833_200,
            last_analysis_stats: {
              malicious: 2,
              suspicious: 1,
              harmless: 12,
              undetected: 58,
              timeout: 0,
              "confirmed-timeout": 0,
              failure: 0,
              "type-unsupported": 3
            },
            popular_threat_classification: { suggested_threat_label: "test.eicar" },
            tags: ["test-file"],
            names: ["hello.txt"],
            last_analysis_results: {
              AlphaAV: {
                category: "malicious",
                result: "EICAR-Test-File",
                method: "blacklist",
                engine_name: "AlphaAV",
                engine_version: "1.0",
                engine_update: "20260815"
              },
              BetaAV: {
                category: "suspicious",
                result: "heuristic",
                method: "blacklist",
                engine_name: "BetaAV"
              }
            }
          }
        }
      });
    }
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
  const vaultReader = {
    readSecret: vi.fn().mockReturnValue("vt-test-key")
  };
  const service = new AnalyzersService(analyzersRepository, casesRepository, auditRepository, launcher, {
    fetchJson,
    spawnProcess,
    vaultReader
  });
  return { db, analyzersRepository, auditRepository, casesRepository, fetchJson, launcherCalls, service, spawnCalls, vaultReader };
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
  const analyzers = timeline.map((item) => item.metadata.analyzer);
  // The dork catalog expanded well past its original five, so assert the family
  // is present in bulk rather than pinning an exact count.
  expect(analyzers.filter((analyzer) => analyzer === "dork").length).toBeGreaterThanOrEqual(20);
  expect(new Set(analyzers)).toEqual(new Set(["dork", "evtx", "mac", "pcap", "vulnerability"]));
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

it("VirusTotal lookup reads the vault key, parses file verdicts, and saves a case finding", async () => {
  const harness = createHarness();
  const caseRecord = harness.casesRepository.create("Malware triage", []);

  const result = await harness.service.lookupVirusTotal({
    sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    fileName: "hello.txt",
    fileSize: 5,
    caseId: caseRecord.id
  });

  expect(harness.vaultReader.readSecret).toHaveBeenCalledWith("virustotal", "local-user", "analyzer.virustotal.lookup");
  const virusTotalCall = harness.fetchJson.mock.calls.find(([url]) => url.includes("virustotal.com/api/v3/files"));
  expect(virusTotalCall?.[0]).toBe("https://www.virustotal.com/api/v3/files/2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  expect(virusTotalCall?.[1]?.headers).toMatchObject({ "x-apikey": "vt-test-key" });
  expect(result.report.detectionStats).toMatchObject({ malicious: 2, suspicious: 1, harmless: 12, undetected: 58 });
  expect(result.report.topDetections.map((detection) => detection.engineName)).toEqual(["AlphaAV", "BetaAV"]);
  expect(result.findings[0]).toMatchObject({
    analyzer: "virustotal",
    type: "file",
    severity: "high",
    source: "https://www.virustotal.com/gui/file/2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
  });

  const timeline = harness.casesRepository.timeline(caseRecord.id);
  expect(timeline.some((item) => item.metadata.analyzer === "virustotal")).toBe(true);
});

it("email header analysis traces hops, scores a spoof, saves findings, and audits the read", () => {
  const harness = createHarness();
  const caseRecord = harness.casesRepository.create("Phishing report", []);

  const rawHeaders = [
    "Received: from mx.recipient.com (mx.recipient.com [198.51.100.20])",
    "\tby inbox.recipient.com with ESMTPS id abc; Fri, 15 Aug 2026 09:14:25 -0700",
    "Received: from evil.attacker.example (unknown [192.0.2.13])",
    "\tby mx.recipient.com with SMTP id ghi; Fri, 15 Aug 2026 16:14:05 +0000",
    "Authentication-Results: mx.recipient.com; spf=fail smtp.mailfrom=attacker.example; dkim=fail; dmarc=fail header.from=paypa1-secure.com",
    "From: \"PayPal\" <service@paypa1-secure.com>",
    "Return-Path: <bounce@attacker.example>",
    "Subject: Your account has been limited",
    "Message-ID: <a1@paypa1-secure.com>"
  ].join("\n");

  const result = harness.service.analyzeEmailHeaders({ rawHeaders, caseId: caseRecord.id });

  expect(result.report.originatingIp).toBe("192.0.2.13");
  expect(result.report.auth).toEqual({ spf: "fail", dkim: "fail", dmarc: "fail" });
  expect(result.report.riskScore).toBeGreaterThanOrEqual(80);
  // A summary finding plus one IOC per pivotable indicator (origin IP + sender domain).
  expect(result.findings.map((finding) => finding.type)).toEqual(["email", "ioc", "ioc"]);
  const ipIoc = result.findings.find((finding) => finding.metadata.seedType === "ip");
  expect(ipIoc?.metadata.pivotSeed).toMatchObject({ type: "ip", value: "192.0.2.13" });

  const timeline = harness.casesRepository.timeline(caseRecord.id);
  expect(timeline.some((item) => item.metadata.analyzer === "email")).toBe(true);
  const audits = harness.auditRepository.list(50);
  expect(audits.some((entry) => entry.action === "analyzer.email.headers")).toBe(true);
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
