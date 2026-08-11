/**
 * Scan handlers expose network scanning through typed IPC because active nmap
 * runs are legal-sensitive host actions. If handlers accepted arbitrary command
 * payloads, the renderer could widen a scan beyond the authorized target.
 */
import type {
  ScanGetRequest,
  ScanGetResponse,
  ScanRunRequest,
  ScanRunResponse,
  ScanTopologyRequest,
  ScanTopologyResponse
} from "../../../shared/schemas/scans.js";
import type { ScanService } from "../../scans/scan-service.js";

export function createScanHandlers(scanService: ScanService) {
  return {
    "scan:run": async (request: ScanRunRequest): Promise<ScanRunResponse> => scanService.run(request),
    "scan:get": (request: ScanGetRequest): ScanGetResponse => scanService.get(request.scanId),
    "scan:topology": (request: ScanTopologyRequest): ScanTopologyResponse => ({
      topology: scanService.topology(request.scanId)
    })
  };
}
