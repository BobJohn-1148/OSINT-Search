/**
 * Social handlers keep candidate generation and verification in main so the
 * renderer cannot silently alter which public networks count as coverage or
 * fake a verification result. If this lived only in UI state, tests could not
 * distinguish candidates from verified evidence.
 */
import type { SocialAnalyzerService } from "../../social/social-analyzer-service.js";
import type { SocialAnalyzeRequest, SocialAnalyzeResponse, SocialVerifyRequest, SocialVerifyResponse } from "../../../shared/schemas/social.js";

export function createSocialHandlers(socialAnalyzerService: SocialAnalyzerService) {
  return {
    "social:analyze": (request: SocialAnalyzeRequest): SocialAnalyzeResponse => socialAnalyzerService.analyze(request),
    "social:verify": async (request: SocialVerifyRequest): Promise<SocialVerifyResponse> => socialAnalyzerService.verify(request)
  };
}
