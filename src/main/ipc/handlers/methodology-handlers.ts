/**
 * Methodology handlers expose reference and export data only. If this channel
 * launched tools directly, the checklist would bypass each tool's own IPC schema
 * and authorization gate.
 */
import type { MethodologyService } from "../../methodology/methodology-service.js";
import type { MethodologyExportResponse, MethodologyListResponse } from "../../../shared/schemas/methodology.js";

export function createMethodologyHandlers(methodologyService: MethodologyService) {
  return {
    "methodology:list": (): MethodologyListResponse => methodologyService.list(),
    "methodology:export": (): MethodologyExportResponse => methodologyService.exportCsv()
  };
}
