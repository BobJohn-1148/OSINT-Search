/**
 * Report renderers share one interface so generation can be audited and listed
 * without branching through format-specific control flow. If handlers called
 * libraries directly, PDF and Word would grow separate security paths.
 */
import type { ReportDocumentModel } from "./report-model.js";

export interface ReportRenderer {
  render(model: ReportDocumentModel): Promise<Buffer>;
}
