/**
 * Mobile handlers expose only bounded inventory operations because phone access
 * is sensitive even when local. If broader device commands crossed IPC, a route
 * could turn into an unreviewed extraction console.
 */
import type { MobileService } from "../../mobile/mobile-service.js";
import type { MobileCollectRequest, MobileCollectResponse, MobileDetectResponse, MobileProfilesResponse } from "../../../shared/schemas/mobile.js";

export function createMobileHandlers(mobileService: MobileService) {
  return {
    "mobile:profiles": (): MobileProfilesResponse => mobileService.profiles(),
    "mobile:detect": async (): Promise<MobileDetectResponse> => mobileService.detect(),
    "mobile:collect": async (request: MobileCollectRequest): Promise<MobileCollectResponse> => mobileService.collect(request)
  };
}
