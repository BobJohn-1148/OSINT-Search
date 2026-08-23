/**
 * Report schemas are shared by IPC and renderer list views so generated files
 * stay tied to durable local rows. If file paths escaped this contract, report
 * opening could drift into arbitrary filesystem access.
 */
import { z } from "zod";
import { reportFormatValues } from "../types/reports.js";

export const reportRecordSchema = z.object({
  id: z.string().min(1),
  caseId: z.string().min(1).nullable(),
  scanId: z.string().min(1).nullable(),
  format: z.enum(reportFormatValues),
  path: z.string().min(1),
  createdTs: z.string().min(1)
});

export const reportGenerateRequestSchema = z.object({
  caseId: z.string().min(1).optional(),
  scanId: z.string().min(1).optional(),
  format: z.enum(reportFormatValues)
}).refine((value) => Boolean(value.caseId) !== Boolean(value.scanId), {
  message: "Provide exactly one caseId or scanId"
});
export const reportGenerateResponseSchema = z.object({ report: reportRecordSchema });

export const reportListRequestSchema = z.object({});
export const reportListResponseSchema = z.object({ reports: z.array(reportRecordSchema) });

export const reportOpenRequestSchema = z.object({ reportId: z.string().min(1) });
export const reportOpenResponseSchema = z.object({ opened: z.boolean() });

export type ReportRecord = z.infer<typeof reportRecordSchema>;
export type ReportGenerateRequest = z.infer<typeof reportGenerateRequestSchema>;
export type ReportGenerateResponse = z.infer<typeof reportGenerateResponseSchema>;
export type ReportListResponse = z.infer<typeof reportListResponseSchema>;
export type ReportOpenRequest = z.infer<typeof reportOpenRequestSchema>;
export type ReportOpenResponse = z.infer<typeof reportOpenResponseSchema>;
