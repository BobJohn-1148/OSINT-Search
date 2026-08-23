/**
 * Tool schemas make launcher input explicit because argv safety depends on
 * structured command pieces, not shell strings. If renderer text became a raw
 * command, WSL launches would lose the fixed-argv invariant.
 */
import { z } from "zod";
import { toolCategoryValues, toolRunStatusValues, toolTierValues } from "../types/tools.js";

export const toolCatalogRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  installCommand: z.string().min(1),
  officialLink: z.string().min(1),
  category: z.enum(toolCategoryValues),
  tier: z.enum(toolTierValues),
  defaultArgs: z.array(z.string()).default([])
});

export const toolRunRecordSchema = z.object({
  id: z.string().min(1),
  toolId: z.string().min(1),
  caseId: z.string().min(1).nullable(),
  target: z.string().min(1),
  wslDistro: z.string().min(1),
  argv: z.array(z.string().min(1)),
  status: z.enum(toolRunStatusValues),
  stdout: z.string(),
  stderr: z.string(),
  startedTs: z.string().min(1),
  completedTs: z.string().min(1).nullable(),
  authorizationId: z.string().min(1).nullable()
});

export const authorizationRecordSchema = z.object({
  id: z.string().min(1),
  target: z.string().min(1),
  tier: z.enum(toolTierValues),
  createdTs: z.string().min(1),
  expiresTs: z.string().min(1)
});

export const toolsListRequestSchema = z.object({});
export const toolsListResponseSchema = z.object({ tools: z.array(toolCatalogRecordSchema) });

export const toolsDetectRequestSchema = z.object({ wslDistro: z.string().min(1).default("Ubuntu") });
export const toolsDetectResponseSchema = z.object({
  installed: z.array(z.object({ toolId: z.string().min(1), installed: z.boolean() }))
});

export const toolsLaunchRequestSchema = z.object({
  toolId: z.string().min(1),
  target: z.string().min(1),
  caseId: z.string().min(1).optional(),
  wslDistro: z.string().min(1).default("Ubuntu")
});
export const toolsLaunchResponseSchema = z.object({ run: toolRunRecordSchema });

export const catalogAddRequestSchema = toolCatalogRecordSchema.omit({ id: true });
export const catalogAddResponseSchema = z.object({ tool: toolCatalogRecordSchema });
export const catalogUpdateRequestSchema = toolCatalogRecordSchema;
export const catalogUpdateResponseSchema = z.object({ tool: toolCatalogRecordSchema });

export const authCreateRequestSchema = z.object({
  target: z.string().min(1),
  tier: z.enum(toolTierValues),
  expiresTs: z.string().min(1)
});
export const authCreateResponseSchema = z.object({ authorization: authorizationRecordSchema });
export const authListRequestSchema = z.object({});
export const authListResponseSchema = z.object({ authorizations: z.array(authorizationRecordSchema) });

export const toolOutputEventSchema = z.object({
  runId: z.string().min(1),
  stream: z.enum(["stdout", "stderr"]),
  chunk: z.string()
});

export type ToolCatalogRecord = z.infer<typeof toolCatalogRecordSchema>;
export type ToolRunRecord = z.infer<typeof toolRunRecordSchema>;
export type AuthorizationRecord = z.infer<typeof authorizationRecordSchema>;
export type ToolsListResponse = z.infer<typeof toolsListResponseSchema>;
export type ToolsDetectRequest = z.infer<typeof toolsDetectRequestSchema>;
export type ToolsDetectResponse = z.infer<typeof toolsDetectResponseSchema>;
export type ToolsLaunchRequest = z.infer<typeof toolsLaunchRequestSchema>;
export type ToolsLaunchResponse = z.infer<typeof toolsLaunchResponseSchema>;
export type CatalogAddRequest = z.infer<typeof catalogAddRequestSchema>;
export type CatalogAddResponse = z.infer<typeof catalogAddResponseSchema>;
export type CatalogUpdateRequest = z.infer<typeof catalogUpdateRequestSchema>;
export type CatalogUpdateResponse = z.infer<typeof catalogUpdateResponseSchema>;
export type AuthCreateRequest = z.infer<typeof authCreateRequestSchema>;
export type AuthCreateResponse = z.infer<typeof authCreateResponseSchema>;
export type AuthListResponse = z.infer<typeof authListResponseSchema>;
export type ToolOutputEvent = z.infer<typeof toolOutputEventSchema>;
