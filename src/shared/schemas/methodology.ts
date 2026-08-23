/**
 * Methodology schemas make the engagement map a read-only coverage model, not a
 * payload surface. If phases and tools were loose UI data, unsafe generators
 * could be added without IPC metadata or tests noticing the change.
 */
import { z } from "zod";

export const methodologyToolSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  surface: z.string().min(1),
  command: z.string().min(1),
  input: z.string().min(1),
  output: z.string().min(1),
  tier: z.enum(["passive", "active", "reference"]),
  authorizationRequired: z.boolean()
});

export const methodologyPhaseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  frameworkRefs: z.array(z.string().min(1)),
  tools: z.array(methodologyToolSchema)
});

export const methodologyListRequestSchema = z.object({});
export const methodologyListResponseSchema = z.object({ phases: z.array(methodologyPhaseSchema) });

export const methodologyExportRequestSchema = z.object({});
export const methodologyExportResponseSchema = z.object({
  filename: z.string().min(1),
  csv: z.string().min(1)
});

export type MethodologyTool = z.infer<typeof methodologyToolSchema>;
export type MethodologyPhase = z.infer<typeof methodologyPhaseSchema>;
export type MethodologyListResponse = z.infer<typeof methodologyListResponseSchema>;
export type MethodologyExportResponse = z.infer<typeof methodologyExportResponseSchema>;
