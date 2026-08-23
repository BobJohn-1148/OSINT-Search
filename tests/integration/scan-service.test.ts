/**
 * Scan service tests use real SQLite and a fake launcher so active authorization,
 * XML parsing, persistence, and report export are exercised together without
 * requiring WSL or touching a real network.
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runMigrations } from "../../src/db/migrations/runner";
import { AuditRepository } from "../../src/db/repositories/audit-repository";
import { CasesRepository } from "../../src/db/repositories/cases-repository";
import { ReportsRepository } from "../../src/db/repositories/reports-repository";
import { ScansRepository } from "../../src/db/repositories/scans-repository";
import { ToolsRepository } from "../../src/db/repositories/tools-repository";
import type { ReportDocumentModel } from "../../src/main/reports/report-model";
import type { ReportRenderer } from "../../src/main/reports/report-renderer";
import { ReportService } from "../../src/main/reports/report-service";
import { ScanService } from "../../src/main/scans/scan-service";
import type { WslRunResult } from "../../src/main/tools/wsl-launcher";
import type { ScanOptions } from "../../src/shared/schemas/scans";

const nmapXml = `<?xml version="1.0"?>
<nmaprun>
  <host>
    <status state="up"/>
    <address addr="192.168.1.10" addrtype="ipv4"/>
    <ports><port protocol="tcp" portid="443"><state state="open"/><service name="https" product="nginx" version="1.25"/></port></ports>
  </host>
</nmaprun>`;

function createHarness() {
  const db = new Database(":memory:");
  runMigrations(db);
  const scansRepository = new ScansRepository(db);
  const toolsRepository = new ToolsRepository(db);
  const auditRepository = new AuditRepository(db);
  const launched: readonly string[][] = [];
  const launcher = {
    run: (input: { readonly argv: readonly string[]; readonly onOutput?: (event: { readonly stream: "stdout" | "stderr"; readonly chunk: string }) => void }): Promise<WslRunResult> => {
      (launched as string[][]).push([...input.argv]);
      input.onOutput?.({ stream: "stdout", chunk: nmapXml });
      return Promise.resolve({ stdout: nmapXml, stderr: "", exitCode: 0 });
    }
  };
  const service = new ScanService(scansRepository, toolsRepository, auditRepository, launcher, () => undefined);
  return { db, scansRepository, toolsRepository, auditRepository, launched, service };
}

it("refuses an unauthorized scan so active targets require exact approval", async () => {
  const harness = createHarness();

  const result = await harness.service.run({
    target: "192.168.1.0/24",
    wslDistro: "Ubuntu",
    options: scanOptions()
  });

  expect(result.scan.status).toBe("blocked");
  expect(result.hosts).toEqual([]);
  expect(harness.launched).toEqual([]);
});

it("rejects custom nmap argv targets so authorization cannot be widened through extra operands", async () => {
  const harness = createHarness();
  harness.toolsRepository.createAuthorization({
    target: "192.168.1.0/24",
    tier: "active",
    expiresTs: new Date(Date.now() + 60_000).toISOString()
  });

  await expect(
    harness.service.run({
      target: "192.168.1.0/24",
      wslDistro: "Ubuntu",
      options: scanOptions({ scanType: "custom", customArgs: ["10.0.0.0/24"] })
    })
  ).rejects.toThrow(/approved target-neutral flags/);
  await expect(
    harness.service.run({
      target: "192.168.1.0/24",
      wslDistro: "Ubuntu",
      options: scanOptions({ scanType: "custom", customArgs: ["--", "10.0.0.0/24"] })
    })
  ).rejects.toThrow(/approved target-neutral flags/);
  await expect(
    harness.service.run({
      target: "192.168.1.0/24",
      wslDistro: "Ubuntu",
      options: scanOptions({ scanType: "custom", customArgs: ["-iL", "targets.txt"] })
    })
  ).rejects.toThrow(/approved target-neutral flags/);
  expect(harness.launched).toEqual([]);
});

it("allows only approved target-neutral custom nmap flags so custom scans stay scoped", async () => {
  const harness = createHarness();
  harness.toolsRepository.createAuthorization({
    target: "192.168.1.0/24",
    tier: "active",
    expiresTs: new Date(Date.now() + 60_000).toISOString()
  });

  const result = await harness.service.run({
    target: "192.168.1.0/24",
    wslDistro: "Ubuntu",
    options: scanOptions({ scanType: "custom", customArgs: ["--reason", "--open"] })
  });

  expect(result.scan.status).toBe("succeeded");
  expect(result.scan.argv).toEqual(["nmap", "-oX", "-", "-T3", "--reason", "--open", "192.168.1.0/24"]);
});

it("runs an authorized scan and captures parsed hosts so topology can render", async () => {
  const harness = createHarness();
  harness.toolsRepository.createAuthorization({
    target: "192.168.1.0/24",
    tier: "active",
    expiresTs: new Date(Date.now() + 60_000).toISOString()
  });

  const result = await harness.service.run({
    target: "192.168.1.0/24",
    wslDistro: "Ubuntu",
    options: scanOptions({ serviceVersion: true })
  });

  expect(result.scan.status).toBe("succeeded");
  expect(result.scan.argv).toEqual(["nmap", "-oX", "-", "-T3", "--top-ports", "100", "-sV", "192.168.1.0/24"]);
  expect(result.hosts[0]).toEqual(expect.objectContaining({ address: "192.168.1.10" }));
  expect(result.hosts[0]?.ports[0]).toEqual(expect.objectContaining({ port: 443, service: "https" }));
  expect(result.topology.nodes.map((node) => node.id)).toContain("target");
});

it("export includes the topology host table and service list so scan reports carry network context", async () => {
  const harness = createHarness();
  harness.toolsRepository.createAuthorization({
    target: "192.168.1.0/24",
    tier: "active",
    expiresTs: new Date(Date.now() + 60_000).toISOString()
  });
  const scanResult = await harness.service.run({
    target: "192.168.1.0/24",
    wslDistro: "Ubuntu",
    options: scanOptions()
  });
  const renderedModels: ReportDocumentModel[] = [];
  const renderer: ReportRenderer = {
    render: (model) => {
      renderedModels.push(model);
      return Promise.resolve(Buffer.from(JSON.stringify(model), "utf8"));
    }
  };
  const reportService = new ReportService(
    new CasesRepository(harness.db),
    new ReportsRepository(harness.db),
    harness.auditRepository,
    harness.scansRepository,
    { pdf: renderer, docx: renderer },
    fs.mkdtempSync(path.join(os.tmpdir(), "reacher-scan-reports-")),
    () => new Date("2026-08-10T12:00:00.000Z")
  );

  const report = await reportService.generate({ scanId: scanResult.scan.id, format: "pdf" });

  expect(fs.existsSync(report.path)).toBe(true);
  expect(renderedModels[0]?.sections.find((section) => section.title === "Scans and topology")?.lines.join("\n")).toContain("192.168.1.10");
  expect(renderedModels[0]?.sections.find((section) => section.title === "Host list")?.lines).toContain("Address | Hostname | Status | Ports");
  expect(renderedModels[0]?.sections.find((section) => section.title === "Service list")?.lines.join("\n")).toContain("192.168.1.10 | 443/tcp | open | https | nginx 1.25");
});

function scanOptions(overrides: Partial<ScanOptions> = {}): ScanOptions {
  return {
    scanType: "quick-top-100",
    timing: "T3",
    customArgs: [],
    skipHostDiscovery: false,
    serviceVersion: false,
    osDetect: false,
    vulnScripts: false,
    ...overrides
  };
}
