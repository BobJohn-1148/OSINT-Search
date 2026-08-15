/**
 * Analyzer schemas make every parser output saveable through the same contract
 * because Phase 9 has five different inputs but one evidence promise. If each
 * analyzer returned bespoke JSON, reports and cases would only understand some
 * of the findings.
 */
import { z } from "zod";
import { analyzerFindingTypeValues, evtxLevelValues } from "../types/analyzers.js";

export const analyzerFindingSchema = z.object({
  id: z.string().min(1),
  analyzer: z.string().min(1),
  type: z.enum(analyzerFindingTypeValues),
  title: z.string().min(1),
  text: z.string().min(1),
  source: z.string().min(1),
  severity: z.string().min(1),
  metadata: z.record(z.string(), z.unknown())
});

export const evtxEventSchema = z.object({
  eventId: z.number().int().min(0),
  provider: z.string(),
  level: z.enum(evtxLevelValues),
  timestamp: z.string(),
  message: z.string()
});

export const pcapConversationSchema = z.object({
  source: z.string().min(1),
  destination: z.string().min(1),
  protocol: z.string().min(1),
  packets: z.number().int().min(1),
  bytes: z.number().int().min(0)
});

export const dorkResultSchema = z.object({
  label: z.string().min(1),
  query: z.string().min(1)
});

export const macLookupResultSchema = z.object({
  mac: z.string().min(1),
  oui: z.string().min(1),
  vendor: z.string().min(1),
  source: z.enum(["offline", "macvendors"])
});

export const vulnerabilityRecordSchema = z.object({
  id: z.string().min(1),
  summary: z.string().min(1),
  severity: z.string().min(1),
  publishedTs: z.string().min(1),
  url: z.string().min(1)
});

export const analyzerEvtxImportRequestSchema = z.object({
  filePath: z.string().min(1),
  caseId: z.string().min(1).optional(),
  eventId: z.number().int().min(0).optional(),
  provider: z.string().min(1).optional(),
  level: z.enum(evtxLevelValues).optional()
});
export const analyzerEvtxImportResponseSchema = z.object({
  importId: z.string().min(1),
  events: z.array(evtxEventSchema),
  findings: z.array(analyzerFindingSchema)
});

export const analyzerPcapImportRequestSchema = z.object({
  filePath: z.string().min(1),
  wslDistro: z.string().min(1).default("Ubuntu"),
  caseId: z.string().min(1).optional()
});
export const analyzerPcapImportResponseSchema = z.object({
  importId: z.string().min(1),
  conversations: z.array(pcapConversationSchema),
  findings: z.array(analyzerFindingSchema)
});

export const analyzerDorkBuildRequestSchema = z.object({
  target: z.string().min(1),
  caseId: z.string().min(1).optional()
});
export const analyzerDorkBuildResponseSchema = z.object({
  dorks: z.array(dorkResultSchema),
  findings: z.array(analyzerFindingSchema)
});

export const analyzerMacLookupRequestSchema = z.object({
  mac: z.string().min(1),
  caseId: z.string().min(1).optional()
});
export const analyzerMacLookupResponseSchema = z.object({
  result: macLookupResultSchema,
  findings: z.array(analyzerFindingSchema)
});

export const analyzerVulnLookupRequestSchema = z.object({
  product: z.string().min(1),
  version: z.string().min(1).optional(),
  caseId: z.string().min(1).optional()
});
export const analyzerVulnLookupResponseSchema = z.object({
  vulnerabilities: z.array(vulnerabilityRecordSchema),
  findings: z.array(analyzerFindingSchema),
  cached: z.boolean()
});

export type AnalyzerFinding = z.infer<typeof analyzerFindingSchema>;
export type EvtxEvent = z.infer<typeof evtxEventSchema>;
export type PcapConversation = z.infer<typeof pcapConversationSchema>;
export type DorkResult = z.infer<typeof dorkResultSchema>;
export type MacLookupResult = z.infer<typeof macLookupResultSchema>;
export type VulnerabilityRecord = z.infer<typeof vulnerabilityRecordSchema>;
export type AnalyzerEvtxImportRequest = z.infer<typeof analyzerEvtxImportRequestSchema>;
export type AnalyzerEvtxImportResponse = z.infer<typeof analyzerEvtxImportResponseSchema>;
export type AnalyzerPcapImportRequest = z.infer<typeof analyzerPcapImportRequestSchema>;
export type AnalyzerPcapImportResponse = z.infer<typeof analyzerPcapImportResponseSchema>;
export type AnalyzerDorkBuildRequest = z.infer<typeof analyzerDorkBuildRequestSchema>;
export type AnalyzerDorkBuildResponse = z.infer<typeof analyzerDorkBuildResponseSchema>;
export type AnalyzerMacLookupRequest = z.infer<typeof analyzerMacLookupRequestSchema>;
export type AnalyzerMacLookupResponse = z.infer<typeof analyzerMacLookupResponseSchema>;
export type AnalyzerVulnLookupRequest = z.infer<typeof analyzerVulnLookupRequestSchema>;
export type AnalyzerVulnLookupResponse = z.infer<typeof analyzerVulnLookupResponseSchema>;
