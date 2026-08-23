/**
 * Monitoring schemas keep watchlist, exposure, and alert rows aligned across
 * main, preload, and renderer. If breach providers returned loose shapes, the
 * dashboard could show alerts that cannot be saved or audited.
 */
import { z } from "zod";
import { watchTargetTypeValues } from "../types/monitoring.js";

export const watchRecordSchema = z.object({
  id: z.string().min(1),
  type: z.enum(watchTargetTypeValues),
  value: z.string().min(1),
  caseId: z.string().min(1).nullable(),
  checkIntervalMinutes: z.number().int().min(1),
  createdTs: z.string().min(1),
  lastCheckedTs: z.string().min(1).nullable()
});

export const exposureRecordSchema = z.object({
  id: z.string().min(1),
  watchId: z.string().min(1),
  source: z.string().min(1),
  title: z.string().min(1),
  detail: z.string().min(1),
  fingerprint: z.string().min(1),
  firstSeenTs: z.string().min(1),
  lastSeenTs: z.string().min(1)
});

export const monitoringAlertSchema = z.object({
  id: z.string().min(1),
  exposureId: z.string().min(1),
  watchId: z.string().min(1),
  message: z.string().min(1),
  createdTs: z.string().min(1),
  acknowledgedTs: z.string().min(1).nullable()
});

export const watchAddRequestSchema = z.object({
  type: z.enum(watchTargetTypeValues),
  value: z.string().min(1),
  caseId: z.string().min(1).optional(),
  checkIntervalMinutes: z.number().int().min(1).default(60)
});
export const watchAddResponseSchema = z.object({ watch: watchRecordSchema });

export const watchListRequestSchema = z.object({});
export const watchListResponseSchema = z.object({
  watches: z.array(watchRecordSchema),
  alerts: z.array(monitoringAlertSchema)
});

export const watchRemoveRequestSchema = z.object({ watchId: z.string().min(1) });
export const watchRemoveResponseSchema = z.object({ removed: z.boolean() });

export const watchCheckNowRequestSchema = z.object({
  watchId: z.string().min(1),
  caseId: z.string().min(1).optional()
});
export const watchCheckNowResponseSchema = z.object({
  watch: watchRecordSchema,
  exposures: z.array(exposureRecordSchema),
  newExposures: z.array(exposureRecordSchema),
  alerts: z.array(monitoringAlertSchema),
  skippedSources: z.array(z.string().min(1)),
  savedItems: z.number().int().min(0),
  searchRunId: z.string().min(1).nullable()
});

export const watchExposuresRequestSchema = z.object({ watchId: z.string().min(1).optional() });
export const watchExposuresResponseSchema = z.object({ exposures: z.array(exposureRecordSchema) });

export const watchReachabilityRequestSchema = z.object({ watchId: z.string().min(1) });
export const watchReachabilityResponseSchema = z.object({ online: z.boolean().nullable() });

export type WatchRecord = z.infer<typeof watchRecordSchema>;
export type ExposureRecord = z.infer<typeof exposureRecordSchema>;
export type MonitoringAlert = z.infer<typeof monitoringAlertSchema>;
export type WatchAddRequest = z.infer<typeof watchAddRequestSchema>;
export type WatchAddResponse = z.infer<typeof watchAddResponseSchema>;
export type WatchListResponse = z.infer<typeof watchListResponseSchema>;
export type WatchRemoveRequest = z.infer<typeof watchRemoveRequestSchema>;
export type WatchRemoveResponse = z.infer<typeof watchRemoveResponseSchema>;
export type WatchCheckNowRequest = z.infer<typeof watchCheckNowRequestSchema>;
export type WatchCheckNowResponse = z.infer<typeof watchCheckNowResponseSchema>;
export type WatchExposuresRequest = z.infer<typeof watchExposuresRequestSchema>;
export type WatchExposuresResponse = z.infer<typeof watchExposuresResponseSchema>;
export type WatchReachabilityRequest = z.infer<typeof watchReachabilityRequestSchema>;
export type WatchReachabilityResponse = z.infer<typeof watchReachabilityResponseSchema>;
