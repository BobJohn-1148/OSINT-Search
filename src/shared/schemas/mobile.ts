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
  unavailableTools: z.array(z.string().min(1))
});

export const mobileSnapshotSchema = z.object({
  id: z.string().min(1),
  platform: z.enum(mobilePlatformValues),
  deviceId: z.string().min(1),
  label: z.string().min(1),
  dataTypeIds: z.array(z.string().min(1)),
  capturedTs: z.string().min(1)
});

export const mobileSnapshotsRequestSchema = z.object({ limit: z.number().int().min(1).max(200).default(50) });
export const mobileSnapshotsResponseSchema = z.object({ snapshots: z.array(mobileSnapshotSchema) });

export type MobilePlatform = (typeof mobilePlatformValues)[number];
export type MobileDataType = z.infer<typeof mobileDataTypeSchema>;
export type MobileDevice = z.infer<typeof mobileDeviceSchema>;
export type MobileProfilesResponse = z.infer<typeof mobileProfilesResponseSchema>;
export type MobileDetectResponse = z.infer<typeof mobileDetectResponseSchema>;
export type MobileSnapshot = z.infer<typeof mobileSnapshotSchema>;
export type MobileSnapshotsRequest = z.infer<typeof mobileSnapshotsRequestSchema>;
export type MobileSnapshotsResponse = z.infer<typeof mobileSnapshotsResponseSchema>;
