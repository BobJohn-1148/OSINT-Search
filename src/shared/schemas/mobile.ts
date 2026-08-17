/**
 * Mobile schemas describe pullable categories before any device command runs so
 * the renderer can show what Android or iOS access means. If raw command output
 * crossed IPC untyped, a connected phone could expose private data without a
 * reviewable local contract.
 */
import { z } from "zod";

export const mobilePlatformValues = ["android", "ios"] as const;

export const mobileDataTypeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  sensitivity: z.enum(["low", "medium", "high", "sensitive"]),
  description: z.string().min(1),
  commandPreview: z.array(z.string().min(1))
});

export const mobileDeviceSchema = z.object({
  id: z.string().min(1),
  platform: z.enum(mobilePlatformValues),
  label: z.string().min(1),
  connected: z.boolean(),
  dataTypes: z.array(mobileDataTypeSchema)
});

export const mobileToolStatusSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  command: z.string().min(1),
  available: z.boolean(),
  path: z.string().min(1).optional(),
  detail: z.string().min(1),
  installHint: z.string().min(1)
});

export const mobileHostUsbDeviceSchema = z.object({
  label: z.string().min(1),
  status: z.string().min(1),
  platformHint: z.enum(mobilePlatformValues).optional()
});

export const mobileProfilesRequestSchema = z.object({});
export const mobileProfilesResponseSchema = z.object({
  profiles: z.array(z.object({
    platform: z.enum(mobilePlatformValues),
    label: z.string().min(1),
    requiredTool: z.string().min(1),
    dataTypes: z.array(mobileDataTypeSchema)
  }))
});

export const mobileDetectRequestSchema = z.object({});
export const mobileDetectResponseSchema = z.object({
  devices: z.array(mobileDeviceSchema),
  unavailableTools: z.array(z.string().min(1)),
  toolStatus: z.array(mobileToolStatusSchema).optional(),
  hostUsbDevices: z.array(mobileHostUsbDeviceSchema).optional()
});

export const mobileCollectionStatusSchema = z.enum(["passed", "failed", "skipped"]);

export const mobileCollectRequestSchema = z.object({
  deviceId: z.string().min(1),
  platform: z.enum(mobilePlatformValues),
  dataTypeIds: z.array(z.string().min(1)).optional()
});

export const mobileCollectionResultSchema = z.object({
  dataTypeId: z.string().min(1),
  label: z.string().min(1),
  sensitivity: z.enum(["low", "medium", "high", "sensitive"]),
  status: mobileCollectionStatusSchema,
  commandPreview: z.array(z.string().min(1)),
  stdout: z.string(),
  stderr: z.string(),
  summary: z.string().min(1),
  startedTs: z.string().min(1),
  completedTs: z.string().min(1)
});

export const mobileCollectResponseSchema = z.object({
  deviceId: z.string().min(1),
  platform: z.enum(mobilePlatformValues),
  completedTs: z.string().min(1),
  results: z.array(mobileCollectionResultSchema)
});

export type MobilePlatform = (typeof mobilePlatformValues)[number];
export type MobileDataType = z.infer<typeof mobileDataTypeSchema>;
export type MobileDevice = z.infer<typeof mobileDeviceSchema>;
export type MobileToolStatus = z.infer<typeof mobileToolStatusSchema>;
export type MobileHostUsbDevice = z.infer<typeof mobileHostUsbDeviceSchema>;
export type MobileProfilesResponse = z.infer<typeof mobileProfilesResponseSchema>;
export type MobileDetectResponse = z.infer<typeof mobileDetectResponseSchema>;
export type MobileCollectRequest = z.infer<typeof mobileCollectRequestSchema>;
export type MobileCollectionResult = z.infer<typeof mobileCollectionResultSchema>;
export type MobileCollectResponse = z.infer<typeof mobileCollectResponseSchema>;
