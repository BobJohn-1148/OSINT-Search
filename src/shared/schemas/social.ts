/**
 * Social analyzer schemas separate candidate generation from verified findings.
 * If Reacher invented matches from URL templates, the correlation tree would
 * contain uncited claims instead of reviewable public-profile leads.
 */
import { z } from "zod";

export const socialCandidateSchema = z.object({
  network: z.string().min(1),
  url: z.string().min(1),
  fields: z.array(z.enum(["profile", "relationships", "images"])),
  status: z.literal("candidate")
});

export const socialAnalyzeRequestSchema = z.object({
  username: z.string().min(1),
  limit: z.number().int().min(1).max(350).default(320)
});

export const socialAnalyzeResponseSchema = z.object({
  username: z.string().min(1),
  totalNetworks: z.number().int().min(300),
  candidates: z.array(socialCandidateSchema),
  recommendedTools: z.array(z.string().min(1))
});

export type SocialCandidate = z.infer<typeof socialCandidateSchema>;
export type SocialAnalyzeRequest = z.infer<typeof socialAnalyzeRequestSchema>;
export type SocialAnalyzeResponse = z.infer<typeof socialAnalyzeResponseSchema>;
