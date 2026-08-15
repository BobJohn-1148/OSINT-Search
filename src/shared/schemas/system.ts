/**
 * The ping channel is intentionally a mutating stub because Phase 0 needs to
 * prove that even harmless app actions can be routed through audit-aware IPC.
 * If health checks bypassed this path, later sensitive actions could copy that
 * shortcut and skip the audit model.
 */
import { z } from "zod";

export const systemPingRequestSchema = z.object({
  nonce: z.string().min(1).default("renderer")
});

export const systemPingResponseSchema = z.object({
  pong: z.literal(true),
  nonce: z.string().min(1),
  audited: z.literal(true)
});

export const systemPickImageRequestSchema = z.object({});
export const systemPickImageResponseSchema = z.object({
  imagePath: z.string().min(1).nullable()
});

export type SystemPingRequest = z.infer<typeof systemPingRequestSchema>;
export type SystemPingResponse = z.infer<typeof systemPingResponseSchema>;
export type SystemPickImageResponse = z.infer<typeof systemPickImageResponseSchema>;
