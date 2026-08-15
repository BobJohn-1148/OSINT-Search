/**
 * Agent schemas make model selection explicit because prompts are versioned
 * files while provider and model choices are local runtime settings. If model
 * choice lived only in settings, agents could not switch providers independently.
 */
import { z } from "zod";
import { approvalModeValues, providerValues } from "../types/providers.js";

export const agentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  provider: z.enum(providerValues),
  model: z.string().min(1),
  promptPath: z.string().min(1),
  approvalMode: z.enum(approvalModeValues)
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

export type AgentRecord = z.infer<typeof agentSchema>;
export type AgentsListRequest = z.infer<typeof agentsListRequestSchema>;
export type AgentsListResponse = z.infer<typeof agentsListResponseSchema>;
export type AgentsSetModelRequest = z.infer<typeof agentsSetModelRequestSchema>;
export type AgentsSetModelResponse = z.infer<typeof agentsSetModelResponseSchema>;
