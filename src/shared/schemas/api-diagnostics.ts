/**
 * API diagnostics schemas separate connectivity status from stored secrets.
 * If diagnostics responses included raw provider errors or key material, a
 * harmless Settings check could become a credential leak.
 */
import { z } from "zod";
import { keySourceValues } from "../types/sources.js";

export const apiDiagnosticStatusSchema = z.enum(["pass", "fail", "not-configured", "skipped"]);
export const apiDiagnosticProbeSchema = z.enum(["live", "vault", "local"]);

export const apiDiagnosticResultSchema = z.object({
  source: z.enum(keySourceValues),
  label: z.string().min(1),
  category: z.string().min(1),
  probe: apiDiagnosticProbeSchema,
  requiresKey: z.boolean(),
  configured: z.boolean(),
  status: apiDiagnosticStatusSchema,
  message: z.string().min(1),
  latencyMs: z.number().int().nonnegative().nullable(),
  checkedTs: z.string().min(1)
});

export const apiDiagnosticsListRequestSchema = z.object({});

export const apiDiagnosticsListResponseSchema = z.object({
  apis: z.array(apiDiagnosticResultSchema)
});

export const apiDiagnosticsTestRequestSchema = z.object({
  sources: z.array(z.enum(keySourceValues)).optional()
});

export const apiDiagnosticsTestResponseSchema = z.object({
  results: z.array(apiDiagnosticResultSchema)
});

export type ApiDiagnosticResult = z.infer<typeof apiDiagnosticResultSchema>;
export type ApiDiagnosticsListRequest = z.infer<typeof apiDiagnosticsListRequestSchema>;
export type ApiDiagnosticsListResponse = z.infer<typeof apiDiagnosticsListResponseSchema>;
export type ApiDiagnosticsTestRequest = z.infer<typeof apiDiagnosticsTestRequestSchema>;
export type ApiDiagnosticsTestResponse = z.infer<typeof apiDiagnosticsTestResponseSchema>;
