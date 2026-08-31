/**
 * Pattern-analysis handlers stay a thin pass-through, same as every other
 * agent handler file, so the long-running model call and citation-grounding
 * logic live in one place (pattern-analysis-service.ts) instead of being
 * duplicated between main and a renderer that cannot be trusted to enforce it.
 */
import type { PatternListRequest, PatternListResponse, PatternRunRequest, PatternRunResponse } from "../../../shared/schemas/pattern-analysis.js";
import type { PatternAnalysisService } from "../../agents/pattern-analysis-service.js";

export function createPatternAnalysisHandlers(patternAnalysisService: PatternAnalysisService) {
  return {
    "pattern:run": (request: PatternRunRequest): Promise<PatternRunResponse> => patternAnalysisService.run(request),
    "pattern:list": (request: PatternListRequest): PatternListResponse => ({
      findings: patternAnalysisService.list(request.caseId)
    })
  };
}
