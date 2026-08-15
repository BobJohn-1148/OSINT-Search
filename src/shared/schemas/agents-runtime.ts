/**
 * Agent runtime schemas are shared so streamed events, persisted rows, and the
 * HQ labels all validate one contract. If step and finding shapes drifted by
 * surface, uncited agent claims could slip past the main-process gate.
 */
import { z } from "zod";
import {
  agentLiveStatusValues,
  agentPlaybookCadenceValues,
  agentRunStatusValues
} from "../types/agents-runtime.js";
import { seedTypeValues } from "../types/search.js";

export const agentSeedSchema = z.object({
  type: z.enum(seedTypeValues),
  value: z.string().min(1)
});

export const STEP_FORMAT = z.object({
  runId: z.string().min(1),
  agentId: z.string().min(1),
  sequence: z.number().int().min(1),
  title: z.string().min(1),
  status: z.enum(["queued", "running", "complete", "error"]),
  summary: z.union([z.string().min(1), z.null()]),
  next: z.union([z.string().min(1), z.null()]),
  sources: z.array(z.string().min(1))
});

export const agentFindingSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  agentId: z.string().min(1),
  caseId: z.string().min(1).nullable(),
  title: z.string().min(1),
  summary: z.string().min(1),
  sources: z.array(z.string().min(1)).min(1),
  confidence: z.number().int().min(1),
  savedItemId: z.string().min(1).nullable()
});

export const agentRunRecordSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  caseId: z.string().min(1).nullable(),
  provider: z.string().min(1),
  model: z.string().min(1),
  seed: agentSeedSchema,
  status: z.enum(agentRunStatusValues),
  startedTs: z.string().min(1),
  completedTs: z.string().min(1).nullable(),
  error: z.string().nullable()
});

export const agentMemoryRecordSchema = z.object({
  id: z.string().min(1),
  scope: z.string().min(1),
  key: z.string().min(1),
  value: z.string().min(1),
  sourceAgent: z.string().min(1),
  citedRun: z.string().min(1),
  confidence: z.number().int().min(1),
  ts: z.string().min(1)
});

export const agentLiveStateSchema = z.object({
  agentId: z.string().min(1),
  status: z.enum(agentLiveStatusValues),
  task: z.string().nullable(),
  lastRunId: z.string().nullable(),
  updatedTs: z.string().min(1)
});

export const agentRuntimeEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("agent:state"), state: agentLiveStateSchema }),
  z.object({ type: z.literal("agent:step"), step: STEP_FORMAT }),
  z.object({ type: z.literal("agent:finding"), finding: agentFindingSchema })
]);

export const agentPlaybookSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  agentId: z.string().min(1),
  cadence: z.enum(agentPlaybookCadenceValues),
  active: z.boolean(),
  nextRunTs: z.string().min(1)
});

export const agentRunRequestSchema = z.object({
  agentId: z.string().min(1).default("osint-agent"),
  seed: agentSeedSchema,
  caseId: z.string().min(1).optional()
});
export const agentRunResponseSchema = z.object({ run: agentRunRecordSchema, finding: agentFindingSchema });

export const agentRunsRequestSchema = z.object({ agentId: z.string().min(1).optional() });
export const agentRunsResponseSchema = z.object({ runs: z.array(agentRunRecordSchema) });

export const agentMemoryListRequestSchema = z.object({
  scope: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(200).default(50)
});
export const agentMemoryListResponseSchema = z.object({ memory: z.array(agentMemoryRecordSchema) });

export const agentStatesRequestSchema = z.object({});
export const agentStatesResponseSchema = z.object({ states: z.array(agentLiveStateSchema) });

export const agentPlaybooksRequestSchema = z.object({});
export const agentPlaybooksResponseSchema = z.object({ playbooks: z.array(agentPlaybookSchema) });

export const agentRuntimeEventBatchSchema = z.object({ events: z.array(agentRuntimeEventSchema) });

export type AgentStep = z.infer<typeof STEP_FORMAT>;
export type AgentFinding = z.infer<typeof agentFindingSchema>;
export type AgentRunRecord = z.infer<typeof agentRunRecordSchema>;
export type AgentMemoryRecord = z.infer<typeof agentMemoryRecordSchema>;
export type AgentLiveState = z.infer<typeof agentLiveStateSchema>;
export type AgentRuntimeEvent = z.infer<typeof agentRuntimeEventSchema>;
export type AgentRuntimeEventBatch = z.infer<typeof agentRuntimeEventBatchSchema>;
export type AgentPlaybook = z.infer<typeof agentPlaybookSchema>;
export type AgentRunRequest = z.infer<typeof agentRunRequestSchema>;
export type AgentRunResponse = z.infer<typeof agentRunResponseSchema>;
export type AgentRunsRequest = z.infer<typeof agentRunsRequestSchema>;
export type AgentRunsResponse = z.infer<typeof agentRunsResponseSchema>;
export type AgentMemoryListRequest = z.infer<typeof agentMemoryListRequestSchema>;
export type AgentMemoryListResponse = z.infer<typeof agentMemoryListResponseSchema>;
export type AgentStatesResponse = z.infer<typeof agentStatesResponseSchema>;
export type AgentPlaybooksResponse = z.infer<typeof agentPlaybooksResponseSchema>;
