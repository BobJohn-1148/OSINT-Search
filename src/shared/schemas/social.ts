/**
 * Social analyzer schemas separate candidate generation from verified findings.
 * If Reacher invented matches from URL templates, the correlation tree would
 * contain uncited claims instead of reviewable public-profile leads.
 *
 * Status starts as "candidate" (template-generated, unchecked) and only moves
 * to "verified" or "absent" after a real HTTP check against the network's own
 * exists/missing detection rule (see social-network-catalog.generated.ts) --
 * never from a bare reachability check, which cannot tell a real profile from
 * a generic "not found" page that also answers 200. "unknown" covers a check
 * that ran but could not tell (network error, timeout, or a site whose
 * protection -- Cloudflare, captcha -- makes a direct fetch unreliable).
 */
import { z } from "zod";

export const socialCandidateStatusValues = ["candidate", "verified", "absent", "unknown"] as const;

export const socialCandidateSchema = z.object({
  network: z.string().min(1),
  url: z.string().min(1),
  fields: z.array(z.enum(["profile", "relationships", "images"])),
  status: z.enum(socialCandidateStatusValues)
});

export const socialAnalyzeRequestSchema = z.object({
  username: z.string().min(1),
  limit: z.number().int().min(1).max(1000).default(700)
});

export const socialAnalyzeResponseSchema = z.object({
  username: z.string().min(1),
  totalNetworks: z.number().int().min(300),
  candidates: z.array(socialCandidateSchema),
  recommendedTools: z.array(z.string().min(1))
});

export const socialVerifyRequestSchema = z.object({
  username: z.string().min(1),
  limit: z.number().int().min(1).max(1000).default(700)
});

export const socialVerifyResponseSchema = z.object({
  username: z.string().min(1),
  candidates: z.array(socialCandidateSchema),
  checkedCount: z.number().int().min(0),
  skippedCount: z.number().int().min(0)
});

export type SocialCandidateStatus = (typeof socialCandidateStatusValues)[number];
export type SocialCandidate = z.infer<typeof socialCandidateSchema>;
export type SocialAnalyzeRequest = z.infer<typeof socialAnalyzeRequestSchema>;
export type SocialAnalyzeResponse = z.infer<typeof socialAnalyzeResponseSchema>;
export type SocialVerifyRequest = z.infer<typeof socialVerifyRequestSchema>;
export type SocialVerifyResponse = z.infer<typeof socialVerifyResponseSchema>;
