/**
 * Audit schemas live in shared code so the database, IPC handlers, and renderer
 * all agree on the append-only event shape. If each side typed this separately,
 * a later sensitive action could appear in UI without matching what was stored.
 */
import { z } from "zod";

export const auditSensitivityValues = ["low", "medium", "high", "sensitive"] as const;

export const auditEventSchema = z.object({
  id: z.number().int().positive(),
  ts: z.string().min(1),
  actor: z.string().min(1),
  action: z.string().min(1),
  objectType: z.string().min(1),
  objectId: z.string().nullable(),
  sensitivity: z.enum(auditSensitivityValues),
  detail: z.record(z.string(), z.unknown())
});

export const auditListRequestSchema = z.object({
  limit: z.number().int().min(1).max(200).default(50)
});

export const auditListResponseSchema = z.object({
  events: z.array(auditEventSchema)
});

export type AuditEvent = z.infer<typeof auditEventSchema>;
export type AuditListRequest = z.infer<typeof auditListRequestSchema>;
export type AuditListResponse = z.infer<typeof auditListResponseSchema>;
export type AuditSensitivity = (typeof auditSensitivityValues)[number];
