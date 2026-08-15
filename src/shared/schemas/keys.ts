/**
 * Key schemas keep plaintext confined to the add request and never expose it in
 * list or test responses. If metadata and secret values shared one response
 * schema, renderer logs could accidentally display credentials.
 */
import { z } from "zod";
import { keySourceValues } from "../types/sources.js";

export const keySourceSchema = z.enum(keySourceValues);

export const keyMetadataSchema = z.object({
  id: z.number().int().positive(),
  source: keySourceSchema,
  createdTs: z.string().min(1),
  lastUsedTs: z.string().nullable()
});

export const keysAddRequestSchema = z.object({
  source: keySourceSchema,
  secret: z.string().min(1)
});

export const keysAddResponseSchema = z.object({
  key: keyMetadataSchema
});

export const keysTestRequestSchema = z.object({
  source: keySourceSchema
});

export const keysTestResponseSchema = z.object({
  source: keySourceSchema,
  ok: z.boolean(),
  message: z.string().min(1)
});

export const keysRevokeRequestSchema = z.object({
  source: keySourceSchema
});

export const keysRevokeResponseSchema = z.object({
  source: keySourceSchema,
  revoked: z.boolean()
});

export const keysListRequestSchema = z.object({});

export const keysListResponseSchema = z.object({
  keys: z.array(keyMetadataSchema)
});

export type KeyMetadata = z.infer<typeof keyMetadataSchema>;
export type KeysAddRequest = z.infer<typeof keysAddRequestSchema>;
export type KeysAddResponse = z.infer<typeof keysAddResponseSchema>;
export type KeysTestRequest = z.infer<typeof keysTestRequestSchema>;
export type KeysTestResponse = z.infer<typeof keysTestResponseSchema>;
export type KeysRevokeRequest = z.infer<typeof keysRevokeRequestSchema>;
export type KeysRevokeResponse = z.infer<typeof keysRevokeResponseSchema>;
export type KeysListRequest = z.infer<typeof keysListRequestSchema>;
export type KeysListResponse = z.infer<typeof keysListResponseSchema>;
