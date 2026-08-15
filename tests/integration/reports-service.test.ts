/**
 * Report service tests pin exports at the case boundary because reports are
 * sensitive local artifacts. If generation skipped cited evidence, durable rows,
 * or audit events, Jack would have polished files with unverifiable provenance.
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
import type { ReportDocumentModel } from "../../src/main/reports/report-model";
import type { ReportRenderer } from "../../src/main/reports/report-renderer";
import { ReportService } from "../../src/main/reports/report-service";

function createHarness() {
  const db = new Database(":memory:");
  runMigrations(db);
  const casesRepository = new CasesRepository(db);
  const reportsRepository = new ReportsRepository(db);
  const scansRepository = new ScansRepository(db);
  const auditRepository = new AuditRepository(db);
  const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "reacher-reports-"));
  const renderedModels: ReportDocumentModel[] = [];
  const renderer: ReportRenderer = {
    render: (model) => {
      renderedModels.push(model);
      return Promise.resolve(Buffer.from(JSON.stringify(model), "utf8"));
    }
  };
  const service = new ReportService(
    casesRepository,
    reportsRepository,
    auditRepository,
    scansRepository,
    { pdf: renderer, docx: renderer },
    outputDirectory,
    () => new Date("2026-08-10T12:00:00.000Z")
  );
  return { casesRepository, reportsRepository, auditRepository, scansRepository, service, renderedModels };
}

function seedCase(casesRepository: CasesRepository) {
  const caseRecord = casesRepository.create("Acme review", ["client"]);
  casesRepository.addItem({
    caseId: caseRecord.id,
    itemType: "observation",
    refId: "obs-later",
    title: "Later finding",
    text: "Beta evidence",
    sourceTs: "2026-08-10T12:00:00.000Z",
    metadata: { entity: "beta.example", strength: 1, sourceId: "rdap" }
  });
  casesRepository.addItem({
    caseId: caseRecord.id,
    itemType: "observation",
    refId: "obs-earlier",
    title: "Earlier finding",
    text: "Alpha evidence",
    sourceTs: "2026-08-10T09:00:00.000Z",
    metadata: { entity: "alpha.example", strength: 3, sourceId: "crtsh" }
  });
  return caseRecord;
}

it("renders a PDF and a DOCX from a case fixture so reports exist as real files", async () => {
  const harness = createHarness();
  const caseRecord = seedCase(harness.casesRepository);

  const pdf = await harness.service.generate({ caseId: caseRecord.id, format: "pdf" });
  const docx = await harness.service.generate({ caseId: caseRecord.id, format: "docx" });

  expect(fs.existsSync(pdf.path)).toBe(true);
  expect(fs.existsSync(docx.path)).toBe(true);
  expect(harness.reportsRepository.list().map((report) => report.format).sort()).toEqual(["docx", "pdf"]);
});

it("the report includes each finding's cited source so summaries remain traceable", async () => {
  const harness = createHarness();
  const caseRecord = seedCase(harness.casesRepository);

  await harness.service.generate({ caseId: caseRecord.id, format: "pdf" });

  expect(harness.renderedModels[0]?.findings).toMatchObject([
    { title: "Earlier finding", citations: [{ id: "C1", label: "crtsh - obs-earlier" }] },
    { title: "Later finding", citations: [{ id: "C2", label: "rdap - obs-later" }] }
  ]);
});

it("generation writes an audit event so report exports are observable", async () => {
  const harness = createHarness();
  const caseRecord = seedCase(harness.casesRepository);

  const report = await harness.service.generate({ caseId: caseRecord.id, format: "pdf" });

  expect(harness.auditRepository.list(10)).toMatchObject([
    {
      action: "report.generate",
      objectType: "report",
      objectId: report.id,
      sensitivity: "medium",
      detail: { caseId: caseRecord.id, format: "pdf", path: report.path }
    }
  ]);
});

it("repeated generation writes distinct artifact paths so old report rows remain auditable", async () => {
  const harness = createHarness();
  const caseRecord = seedCase(harness.casesRepository);

  const first = await harness.service.generate({ caseId: caseRecord.id, format: "pdf" });
  const second = await harness.service.generate({ caseId: caseRecord.id, format: "pdf" });

  expect(first.path).not.toBe(second.path);
  expect(fs.existsSync(first.path)).toBe(true);
  expect(fs.existsSync(second.path)).toBe(true);
});

it("output is deterministic for a fixed fixture so repeated report renders stay reviewable", async () => {
  const first = createHarness();
  const firstCase = seedCase(first.casesRepository);
  const second = createHarness();
  const secondCase = seedCase(second.casesRepository);

  await first.service.generate({ caseId: firstCase.id, format: "pdf" });
  await second.service.generate({ caseId: secondCase.id, format: "pdf" });

  const firstModel = first.renderedModels[0];
  const secondModel = second.renderedModels[0];
  expect(firstModel.title).toBe(secondModel.title);
  expect(firstModel.generatedTs).toBe(secondModel.generatedTs);
  expect(firstModel.summaryLines).toEqual(secondModel.summaryLines);
  expect(firstModel.findings.map((finding) => [finding.title, finding.text, finding.citations[0]?.label])).toEqual(
    secondModel.findings.map((finding) => [finding.title, finding.text, finding.citations[0]?.label])
  );
  expect(firstModel.findings.map((finding) => finding.title)).toEqual(["Earlier finding", "Later finding"]);
});
