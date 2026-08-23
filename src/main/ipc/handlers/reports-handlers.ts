/**
 * Report handlers keep file generation and opening in the main process because
 * reports touch local paths and audit state. If the renderer passed arbitrary
 * paths to Electron, the report list would stop being the security boundary.
 */
import type { ReportsRepository } from "../../../db/repositories/reports-repository.js";
import type {
  ReportGenerateRequest,
  ReportGenerateResponse,
  ReportListResponse,
  ReportOpenRequest,
  ReportOpenResponse
} from "../../../shared/schemas/reports.js";
import type { ReportService } from "../../reports/report-service.js";

export function createReportsHandlers(
  reportService: ReportService,
  reportsRepository: ReportsRepository,
  openPath: (filePath: string) => Promise<string>
) {
  return {
    "report:generate": async (request: ReportGenerateRequest): Promise<ReportGenerateResponse> => ({
      report: await reportService.generate(request)
    }),
    "report:list": (): ReportListResponse => ({
      reports: reportService.list()
    }),
    "report:open": async (request: ReportOpenRequest): Promise<ReportOpenResponse> => {
      const report = reportsRepository.get(request.reportId);
      if (!report) {
        throw new Error(`Report ${request.reportId} does not exist`);
      }
      const error = await openPath(report.path);
      if (error) {
        throw new Error(error);
      }
      return { opened: true };
    }
  };
}
