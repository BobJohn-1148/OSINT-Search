/**
 * API diagnostics handlers keep live checks in main because secrets and network
 * probes must stay behind the audited IPC boundary.
 */
import type { ApiDiagnosticsService } from "../../diagnostics/api-diagnostics-service.js";
import type {
  ApiDiagnosticsListResponse,
  ApiDiagnosticsTestRequest,
  ApiDiagnosticsTestResponse
} from "../../../shared/schemas/api-diagnostics.js";

export function createApiDiagnosticsHandlers(apiDiagnosticsService: ApiDiagnosticsService) {
  return {
    "apiDiagnostics:list": (): ApiDiagnosticsListResponse => ({
      apis: apiDiagnosticsService.list()
    }),
    "apiDiagnostics:test": async (request: ApiDiagnosticsTestRequest): Promise<ApiDiagnosticsTestResponse> => ({
      results: await apiDiagnosticsService.test(request.sources)
    })
  };
}
