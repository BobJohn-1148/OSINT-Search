/**
 * Report persistence owns rows for generated files so handlers never insert SQL
 * while writing documents. If render services wrote report rows directly, audit
 * and list behavior would fork by output format.
 */
import { randomUUID } from "node:crypto";
import type { ReacherDatabase } from "../database.js";
import type { ReportRecord } from "../../shared/schemas/reports.js";
import type { ReportFormat } from "../../shared/types/reports.js";

interface ReportRow {
  readonly id: string;
  readonly case_id: string | null;
  readonly scan_id: string | null;
  readonly format: ReportFormat;
  readonly path: string;
  readonly created_ts: string;
}

export class ReportsRepository {
  public constructor(private readonly db: ReacherDatabase) {}

  public create(input: {
    readonly caseId?: string | null;
    readonly scanId?: string | null;
    readonly format: ReportFormat;
    readonly path: string;
  }): ReportRecord {
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO reports (id, case_id, scan_id, format, path) VALUES (?, ?, ?, ?, ?)")
      .run(id, input.caseId ?? null, input.scanId ?? null, input.format, input.path);
    return this.get(id) ?? this.missingReport(id);
  }

  public list(): ReportRecord[] {
    const rows = this.db.prepare("SELECT * FROM reports ORDER BY created_ts DESC, id DESC").all() as ReportRow[];
    return rows.map((row) => this.toReport(row));
  }

  public get(reportId: string): ReportRecord | null {
    const row = this.db.prepare("SELECT * FROM reports WHERE id = ?").get(reportId) as ReportRow | undefined;
    return row ? this.toReport(row) : null;
  }

  private toReport(row: ReportRow): ReportRecord {
    return {
      id: row.id,
      caseId: row.case_id,
      scanId: row.scan_id,
      format: row.format,
      path: row.path,
      createdTs: row.created_ts
    };
  }

  private missingReport(reportId: string): never {
    throw new Error(`Report ${reportId} was not persisted`);
  }
}
