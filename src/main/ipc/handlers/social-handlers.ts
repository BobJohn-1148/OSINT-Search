/**
 * Social handlers keep candidate generation in main so the renderer cannot
 * silently alter which public networks count as coverage. If this lived only in
 * UI state, tests could not distinguish candidates from verified evidence.
 */
import type { SocialAnalyzerService } from "../../social/social-analyzer-service.js";
import type { SocialAnalyzeRequest, SocialAnalyzeResponse } from "../../../shared/schemas/social.js";

export function createSocialHandlers(socialAnalyzerService: SocialAnalyzerService) {
  return {
    "social:analyze": (request: SocialAnalyzeRequest): SocialAnalyzeResponse => socialAnalyzerService.analyze(request)
  };
}
