/**
 * Architect schemas require explicit citations and proposal ids because Codex
 * actions must stay reviewable before any write is confirmed. If prose answers
 * crossed IPC without structure, the app could not prove which files informed a
 * plan or which plan was approved.
 */
import { z } from "zod";

export const repoCitationSchema = z.object({
  file: z.string().min(1),
  excerpt: z.string().min(1)
});

export const architectPlanStepSchema = z.object({
  title: z.string().min(1),
  files: z.array(z.string().min(1)).min(1),
  reason: z.string().min(1)
});

export const architectProposalSchema = z.object({
  id: z.string().min(1),
  agentId: z.literal("architect-agent"),
  request: z.string().min(1),
  summary: z.string().min(1),
  steps: z.array(architectPlanStepSchema).min(1),
  citations: z.array(repoCitationSchema).min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  createdTs: z.string().min(1)
});

export const architectAskRequestSchema = z.object({
  question: z.string().min(1),
  files: z.array(z.string().min(1)).default([])
});
export const architectAskResponseSchema = z.object({
  answer: z.string().min(1),
  citations: z.array(repoCitationSchema).min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  memoryCount: z.number().int().min(0)
});

export const architectProposePlanRequestSchema = z.object({
  request: z.string().min(1),
  files: z.array(z.string().min(1)).default([])
});
export const architectProposePlanResponseSchema = z.object({
  proposal: architectProposalSchema,
  memoryCount: z.number().int().min(0)
});

export const architectApplyRequestSchema = z.object({
  proposalId: z.string().min(1)
});
export const architectApplyResponseSchema = z.object({
  proposalId: z.string().min(1),
  applied: z.boolean(),
  memoryKey: z.string().min(1).nullable(),
  changedFiles: z.array(z.string().min(1)),
  audited: z.boolean()
});

export type RepoCitation = z.infer<typeof repoCitationSchema>;
export type ArchitectProposal = z.infer<typeof architectProposalSchema>;
export type ArchitectAskRequest = z.infer<typeof architectAskRequestSchema>;
export type ArchitectAskResponse = z.infer<typeof architectAskResponseSchema>;
export type ArchitectProposePlanRequest = z.infer<typeof architectProposePlanRequestSchema>;
export type ArchitectProposePlanResponse = z.infer<typeof architectProposePlanResponseSchema>;
export type ArchitectApplyRequest = z.infer<typeof architectApplyRequestSchema>;
export type ArchitectApplyResponse = z.infer<typeof architectApplyResponseSchema>;
