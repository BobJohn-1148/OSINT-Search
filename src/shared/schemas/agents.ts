/**
 * Agent schemas make model selection explicit because prompts are versioned
 * files while provider and model choices are local runtime settings. If model
 * choice lived only in settings, agents could not switch providers independently.
 */
import { z } from "zod";
import { approvalModeValues, providerValues, reasoningEffortValues } from "../types/providers.js";

export const agentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  provider: z.enum(providerValues),
  model: z.string().min(1),
  promptPath: z.string().min(1),
  approvalMode: z.enum(approvalModeValues),
  // Null means "use the provider's own default effort" — distinct from a chosen
  // rung, so the UI can show a real "Default" option rather than guessing.
  reasoningEffort: z.enum(reasoningEffortValues).nullable()
});

export const agentsListRequestSchema = z.object({});

export const agentsListResponseSchema = z.object({
  agents: z.array(agentSchema)
});

export const agentsSetModelRequestSchema = z.object({
  agentId: z.string().min(1),
  provider: z.enum(providerValues),
  model: z.string().min(1)
});

export const agentsSetModelResponseSchema = z.object({
  agent: agentSchema
});

export const agentsSetEffortRequestSchema = z.object({
  agentId: z.string().min(1),
  // Null clears the override back to the provider default.
  reasoningEffort: z.enum(reasoningEffortValues).nullable()
});

export const agentsSetEffortResponseSchema = z.object({
  agent: agentSchema
});

export type AgentRecord = z.infer<typeof agentSchema>;
export type AgentsListRequest = z.infer<typeof agentsListRequestSchema>;
export type AgentsListResponse = z.infer<typeof agentsListResponseSchema>;
export type AgentsSetModelRequest = z.infer<typeof agentsSetModelRequestSchema>;
export type AgentsSetModelResponse = z.infer<typeof agentsSetModelResponseSchema>;
export type AgentsSetEffortRequest = z.infer<typeof agentsSetEffortRequestSchema>;
export type AgentsSetEffortResponse = z.infer<typeof agentsSetEffortResponseSchema>;
