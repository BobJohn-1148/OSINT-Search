/**
 * Settings are string-valued in Phase 0 so they can persist shell preferences
 * without inventing a configuration object before the vault and provider phases.
 * If arbitrary JSON were accepted here, later migrations would have to defend
 * against unaudited shape drift.
 */
import { z } from "zod";

export const settingsGetRequestSchema = z.object({
  key: z.string().min(1)
});

export const settingsGetResponseSchema = z.object({
  key: z.string().min(1),
  value: z.string().nullable()
});

export const settingsSetRequestSchema = z.object({
  key: z.string().min(1),
  value: z.string()
});

export const settingsSetResponseSchema = z.object({
  key: z.string().min(1),
  value: z.string()
});

export type SettingsGetRequest = z.infer<typeof settingsGetRequestSchema>;
export type SettingsGetResponse = z.infer<typeof settingsGetResponseSchema>;
export type SettingsSetRequest = z.infer<typeof settingsSetRequestSchema>;
export type SettingsSetResponse = z.infer<typeof settingsSetResponseSchema>;
