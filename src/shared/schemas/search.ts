/**
 * Search schemas protect the IPC boundary from becoming an arbitrary web-query
 * pipe. If the renderer could send loose objects here, source connectors would
 * need to defend every request separately and the correlation tests would drift.
 */
import { z } from "zod";
import type { SearchTreeNode } from "../types/search.js";
import { seedTypeValues, strengthBandValues } from "../types/search.js";

export const searchSeedSchema = z.object({
  type: z.enum(seedTypeValues),
  value: z.string().min(1)
});

export const observationSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  entity: z.string().min(1),
  type: z.string().min(1),
  value: z.string().min(1),
  source: z.string().min(1),
  confidence: z.number().int().min(1),
  raw: z.record(z.string(), z.unknown()).optional()
});

export const sourceStatusSchema = z.object({
  sourceId: z.string().min(1),
  label: z.string().min(1),
  status: z.enum(["returned", "failed"]),
  observationCount: z.number().int().min(0),
  error: z.string().optional()
});

export const correlatedEntitySchema = z.object({
  entity: z.string().min(1),
  type: z.string().min(1),
  value: z.string().min(1),
  sourceIds: z.array(z.string().min(1)),
  strength: z.number().int().min(1),
  band: z.enum(strengthBandValues)
});

export const searchTreeNodeSchema: z.ZodType<SearchTreeNode> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    kind: z.enum(["root", "source", "observation"] as const),
    sourceId: z.string().optional(),
    observationId: z.string().optional(),
    entity: z.string().optional(),
    strength: z.number().int().min(1).optional(),
    band: z.enum(strengthBandValues).optional(),
    saveable: z.boolean(),
    pivotSeed: searchSeedSchema.optional(),
    children: z.array(searchTreeNodeSchema)
  })
);

export const searchRunResultSchema = z.object({
  runId: z.string().min(1),
  seed: searchSeedSchema,
  startedTs: z.string().min(1),
  completedTs: z.string().nullable(),
  statuses: z.array(sourceStatusSchema),
  observations: z.array(observationSchema),
  entities: z.array(correlatedEntitySchema),
  tree: searchTreeNodeSchema
});

export const searchRunRequestSchema = z.object({
  seed: searchSeedSchema,
  runId: z.string().min(1).optional()
});

export const searchRunResponseSchema = z.object({
  run: searchRunResultSchema
});

export const searchPivotRequestSchema = z.object({
  seed: searchSeedSchema,
  runId: z.string().min(1).optional()
});

export const searchPivotResponseSchema = searchRunResponseSchema;

export const searchGetRequestSchema = z.object({
  runId: z.string().min(1)
});

export const searchGetResponseSchema = z.object({
  run: searchRunResultSchema.nullable()
});

export const searchCancelRequestSchema = z.object({
  runId: z.string().min(1)
});

export const searchCancelResponseSchema = z.object({
  runId: z.string().min(1),
  cancelled: z.boolean()
});

export type SearchRunRequest = z.infer<typeof searchRunRequestSchema>;
export type SearchRunResponse = z.infer<typeof searchRunResponseSchema>;
export type SearchPivotRequest = z.infer<typeof searchPivotRequestSchema>;
export type SearchPivotResponse = z.infer<typeof searchPivotResponseSchema>;
export type SearchGetRequest = z.infer<typeof searchGetRequestSchema>;
export type SearchGetResponse = z.infer<typeof searchGetResponseSchema>;
export type SearchCancelRequest = z.infer<typeof searchCancelRequestSchema>;
export type SearchCancelResponse = z.infer<typeof searchCancelResponseSchema>;
