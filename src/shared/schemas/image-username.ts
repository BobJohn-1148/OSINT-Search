/**
 * Phase 11 schemas return normal search runs because reverse image and username
 * depth must feed the same correlation tree as passive search. If they returned
 * bespoke result cards, cases and reports would need another evidence pathway.
 */
import { z } from "zod";
import { imageSearchSourceValues } from "../types/image-username.js";
import { searchRunResultSchema } from "./search.js";

export const imageSearchRecordSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  source: z.enum(imageSearchSourceValues),
  resultRef: z.string().min(1),
  ts: z.string().min(1)
});

export const browserLaunchSchema = z.object({
  source: z.enum(["browser-google-lens", "browser-yandex"] as const),
  url: z.string().min(1)
});

export const searchImageRequestSchema = z.object({
  imagePath: z.string().min(1),
  caseId: z.string().min(1).optional()
});
export const searchImageResponseSchema = z.object({
  run: searchRunResultSchema,
  records: z.array(imageSearchRecordSchema),
  savedItems: z.number().int().min(0),
  usedBrowserFallback: z.boolean(),
  browserLaunches: z.array(browserLaunchSchema)
});

export const usernameSweepRequestSchema = z.object({
  username: z.string().min(1),
  wslDistro: z.string().min(1).default("Ubuntu"),
  caseId: z.string().min(1).optional(),
  sendToAgent: z.boolean().default(true)
});
export const usernameSweepResponseSchema = z.object({
  run: searchRunResultSchema,
  savedItems: z.number().int().min(0),
  toolRunIds: z.array(z.string().min(1)),
  agentRunId: z.string().min(1).nullable()
});

export type ImageSearchRecord = z.infer<typeof imageSearchRecordSchema>;
export type BrowserLaunch = z.infer<typeof browserLaunchSchema>;
export type SearchImageRequest = z.infer<typeof searchImageRequestSchema>;
export type SearchImageResponse = z.infer<typeof searchImageResponseSchema>;
export type UsernameSweepRequest = z.infer<typeof usernameSweepRequestSchema>;
export type UsernameSweepResponse = z.infer<typeof usernameSweepResponseSchema>;
