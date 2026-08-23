/**
 * Monitoring handlers keep watchlist calls thin so provider lookup policy stays
 * in the service. If handlers performed breach checks themselves, key skipping,
 * alerts, and save-to-case dedupe would split across IPC channels.
 */
import type {
  WatchAddRequest,
  WatchAddResponse,
  WatchCheckNowRequest,
  WatchCheckNowResponse,
  WatchExposuresRequest,
  WatchExposuresResponse,
  WatchListResponse,
  WatchReachabilityRequest,
  WatchReachabilityResponse,
  WatchRemoveRequest,
  WatchRemoveResponse
} from "../../../shared/schemas/monitoring.js";
import type { MonitoringService } from "../../monitoring/monitoring-service.js";

export function createMonitoringHandlers(monitoringService: MonitoringService) {
  return {
    "watch:add": (request: WatchAddRequest): WatchAddResponse => ({ watch: monitoringService.addWatch(request) }),
    "watch:list": (): WatchListResponse => monitoringService.listWatches(),
    "watch:remove": (request: WatchRemoveRequest): WatchRemoveResponse => ({
      removed: monitoringService.removeWatch(request.watchId)
    }),
    "watch:checkNow": (request: WatchCheckNowRequest): Promise<WatchCheckNowResponse> =>
      monitoringService.checkNow(request),
    "watch:exposures": (request: WatchExposuresRequest): WatchExposuresResponse => ({
      exposures: monitoringService.exposures(request.watchId)
    }),
    "watch:reachability": (request: WatchReachabilityRequest): Promise<WatchReachabilityResponse> =>
      monitoringService.checkReachability(request.watchId)
  };
}
