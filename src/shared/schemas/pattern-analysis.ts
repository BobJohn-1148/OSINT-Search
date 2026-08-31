/**
 * Pattern-analysis schemas live apart from agents-runtime.ts because this agent
 * is seeded by a whole case, not one entity -- it does not fit agentSeedSchema's
 * closed seed-type enum (email/ip/phone/username/domain/business/mac/image), and
 * forcing it through AgentRunRequest would mean inventing a fake seed type that
 * means nothing to any other agent or to AgentRuntimeService.run(). A pattern
 * finding is persisted as an ordinary case_items row (item_type
 * 'pattern_finding'), the same save-to-case path every other finding uses, so
 * this schema is the read-back shape the service and renderer share rather than
 * a new storage contract.
 */
import { z } from "zod";
import { patternTypeValues } from "../types/pattern-analysis.js";

export const patternFindingSchema = z.object({
  id: z.string().min(1),
  caseId: z.string().min(1),
  patternType: z.enum(patternTypeValues),
  description: z.string().min(1),
  // Case-item ids the pattern connects -- the same ids the case timeline and
  // evidence viewer already use, so a citation chip can jump straight to the
  // evidence it names instead of pointing at a second, disconnected id space.
  observationIds: z.array(z.string().min(1)).min(1),
  confidence: z.number().int().min(1),
  ts: z.string().min(1)
});

export const patternRunRequestSchema = z.object({ caseId: z.string().min(1) });
export const patternRunResponseSchema = z.object({ findings: z.array(patternFindingSchema) });

export const patternListRequestSchema = z.object({ caseId: z.string().min(1) });
export const patternListResponseSchema = z.object({ findings: z.array(patternFindingSchema) });

export type PatternFinding = z.infer<typeof patternFindingSchema>;
export type PatternRunRequest = z.infer<typeof patternRunRequestSchema>;
export type PatternRunResponse = z.infer<typeof patternRunResponseSchema>;
export type PatternListRequest = z.infer<typeof patternListRequestSchema>;
export type PatternListResponse = z.infer<typeof patternListResponseSchema>;
