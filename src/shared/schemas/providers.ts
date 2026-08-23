/**
 * Provider schemas describe connection capability without allowing adapters to
 * leak prompts or secrets. If provider tests returned raw client errors, key
 * material could end up in renderer-visible status text.
 */
import { z } from "zod";
import { providerValues, reasoningEffortValues } from "../types/providers.js";

export const providerSchema = z.enum(providerValues);
export const reasoningEffortSchema = z.enum(reasoningEffortValues);

export const providerInfoSchema = z.object({
  id: providerSchema,
  label: z.string().min(1),
  keySource: z.string().min(1).nullable(),
  requiresKey: z.boolean(),
  configured: z.boolean(),
  defaultModel: z.string().min(1),
  availableModels: z.array(z.string().min(1)),
  supportedEfforts: z.array(reasoningEffortSchema)
});

export const providersListRequestSchema = z.object({});

export const providersListResponseSchema = z.object({
  providers: z.array(providerInfoSchema)
});

export const providersTestRequestSchema = z.object({
  provider: providerSchema
});

export const providersTestResponseSchema = z.object({
  provider: providerSchema,
  ok: z.boolean(),
  message: z.string().min(1),
  model: z.string().min(1)
});

export type ProviderInfo = z.infer<typeof providerInfoSchema>;
export type ProvidersListRequest = z.infer<typeof providersListRequestSchema>;
export type ProvidersListResponse = z.infer<typeof providersListResponseSchema>;
export type ProvidersTestRequest = z.infer<typeof providersTestRequestSchema>;
export type ProvidersTestResponse = z.infer<typeof providersTestResponseSchema>;
