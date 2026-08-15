/**
 * Report service coordinates evidence reads, renderer output, durable rows, and
 * audit events in one main-process path. If the renderer generated files itself,
 * report creation could block UI state and bypass the append-only audit trail.
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AuditRepository } from "../../db/repositories/audit-repository.js";
import type { CasesRepository } from "../../db/repositories/cases-repository.js";
import type { ReportsRepository } from "../../db/repositories/reports-repository.js";
import type { ScansRepository } from "../../db/repositories/scans-repository.js";
import type { ReportRecord } from "../../shared/schemas/reports.js";
import type { ReportFormat } from "../../shared/types/reports.js";
import { buildCaseReportModel, buildScanReportModel } from "./report-model.js";
import type { ReportRenderer } from "./report-renderer.js";
import { buildScanTopology } from "../scans/topology-layout.js";

export class ReportService {
  public constructor(
    private readonly casesRepository: CasesRepository,
    private readonly reportsRepository: ReportsRepository,
    private readonly auditRepository: AuditRepository,
    private readonly scansRepository: ScansRepository,
    private readonly renderers: Record<ReportFormat, ReportRenderer>,
    private readonly outputDirectory: string,
    private readonly now = () => new Date()
  ) {}

  public async generate(input: {
    readonly caseId?: string;
    readonly scanId?: string;
    readonly format: ReportFormat;
  }): Promise<ReportRecord> {
    if (input.scanId) {
      return this.generateScanReport(input.scanId, input.format);
    }
    if (!input.caseId) {
      throw new Error("A case id is required for Phase 4 reports");
    }

    const caseBundle = this.casesRepository.get(input.caseId);
    if (!caseBundle.case) {
      throw new Error(`Case ${input.caseId} does not exist`);
    }
    const generatedTs = this.now().toISOString();
    const model = buildCaseReportModel({
      caseRecord: caseBundle.case,
      timeline: caseBundle.items,
      summary: this.casesRepository.summary(input.caseId),
      generatedTs
    });
    const buffer = await this.renderers[input.format].render(model);
    await fs.mkdir(this.outputDirectory, { recursive: true });
    const artifactId = randomUUID();
    const outputPath = path.join(this.outputDirectory, `${safeFileName(caseBundle.case.title)}-${artifactId}.${input.format}`);
    await fs.writeFile(outputPath, buffer);

    const report = this.reportsRepository.create({
      caseId: input.caseId,
      format: input.format,
      path: outputPath
    });
    this.casesRepository.addItem({
      caseId: input.caseId,
      itemType: "report",
      refId: report.id,
      title: `${input.format.toUpperCase()} report`,
      text: `Generated ${input.format.toUpperCase()} report at ${outputPath}`,
      sourceTs: generatedTs,
      metadata: { reportId: report.id, format: input.format, entity: caseBundle.case.title, strength: 1 }
    });
    this.auditRepository.record({
      actor: "local-user",
      action: "report.generate",
      objectType: "report",
      objectId: report.id,
      sensitivity: "medium",
      detail: { caseId: input.caseId, format: input.format, path: outputPath }
    });
    return report;
  }

  public list(): ReportRecord[] {
    return this.reportsRepository.list();
  }

  private async generateScanReport(scanId: string, format: ReportFormat): Promise<ReportRecord> {
    const bundle = this.scansRepository.get(scanId);
    if (!bundle.scan) {
      throw new Error(`Scan ${scanId} does not exist`);
    }
    const generatedTs = this.now().toISOString();
    const model = buildScanReportModel({
      scan: bundle.scan,
      hosts: bundle.hosts,
      topology: buildScanTopology(scanId, bundle.scan.target, bundle.hosts),
      generatedTs
    });
    const buffer = await this.renderers[format].render(model);
    await fs.mkdir(this.outputDirectory, { recursive: true });
    const artifactId = randomUUID();
    const outputPath = path.join(this.outputDirectory, `${safeFileName(bundle.scan.target)}-${artifactId}.${format}`);
    await fs.writeFile(outputPath, buffer);
    const report = this.reportsRepository.create({
      scanId,
      format,
      path: outputPath
    });
    this.auditRepository.record({
      actor: "local-user",
      action: "report.generate",
      objectType: "report",
      objectId: report.id,
      sensitivity: "medium",
      detail: { scanId, format, path: outputPath }
    });
    return report;
  }
}

function safeFileName(value: string): string {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return cleaned || "reacher-report";
}
