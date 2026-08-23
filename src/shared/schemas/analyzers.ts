/**
 * Analyzer schemas make every parser output saveable through the same contract
 * because Phase 9 has five different inputs but one evidence promise. If each
 * analyzer returned bespoke JSON, reports and cases would only understand some
 * of the findings.
 */
import { z } from "zod";
import { analyzerFindingTypeValues, emailAuthVerdictValues, evtxLevelValues, iocKindValues } from "../types/analyzers.js";
import { seedTypeValues } from "../types/search.js";

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

export const virusTotalDetectionStatsSchema = z.object({
  malicious: z.number().int().nonnegative(),
  suspicious: z.number().int().nonnegative(),
  harmless: z.number().int().nonnegative(),
  undetected: z.number().int().nonnegative(),
  timeout: z.number().int().nonnegative(),
  confirmedTimeout: z.number().int().nonnegative(),
  failure: z.number().int().nonnegative(),
  typeUnsupported: z.number().int().nonnegative()
});

export const virusTotalEngineResultSchema = z.object({
  engineName: z.string().min(1),
  category: z.string().min(1),
  result: z.string().nullable(),
  method: z.string().nullable(),
  engineVersion: z.string().nullable(),
  engineUpdate: z.string().nullable()
});

export const virusTotalReportSchema = z.object({
  id: z.string().min(1),
  sha256: z.string().min(1),
  sha1: z.string().nullable(),
  md5: z.string().nullable(),
  fileName: z.string().min(1),
  fileSize: z.number().int().nonnegative().nullable(),
  typeDescription: z.string().nullable(),
  meaningfulName: z.string().nullable(),
  magic: z.string().nullable(),
  reputation: z.number().int().nullable(),
  firstSubmissionTs: z.string().nullable(),
  lastAnalysisTs: z.string().nullable(),
  lastModificationTs: z.string().nullable(),
  detectionStats: virusTotalDetectionStatsSchema,
  topDetections: z.array(virusTotalEngineResultSchema),
  names: z.array(z.string()),
  tags: z.array(z.string()),
  threatLabel: z.string().nullable(),
  guiUrl: z.string().min(1),
  apiUrl: z.string().min(1),
  rawJson: z.record(z.string(), z.unknown())
});

export const iocSchema = z.object({
  kind: z.enum(iocKindValues),
  value: z.string().min(1),
  // Nullable rather than optional: an unseedable indicator (mutex, PDB path)
  // still needs to render, and null says "evidence, not a pivot" explicitly.
  seedType: z.enum(seedTypeValues).nullable(),
  occurrences: z.number().int().min(1)
});

export const peSectionSchema = z.object({
  name: z.string().min(1),
  virtualSize: z.number().int().nonnegative(),
  rawSize: z.number().int().nonnegative(),
  // Shannon entropy 0..8 bits/byte; >7.2 is the packed/encrypted tell.
  entropy: z.number().min(0).max(8),
  suspicious: z.boolean()
});

export const peImportSchema = z.object({
  dll: z.string().min(1),
  functions: z.array(z.string().min(1))
});

export const peInfoSchema = z.object({
  machine: z.string().min(1),
  isDll: z.boolean(),
  subsystem: z.string().min(1),
  compileTimestampTs: z.string().nullable(),
  hasAuthenticode: z.boolean(),
  sections: z.array(peSectionSchema),
  imports: z.array(peImportSchema),
  // API imports that map to capability (VirtualAlloc, WinExec, InternetOpenA…).
  suspiciousImports: z.array(z.string().min(1))
});

export const malwareTriageReportSchema = z.object({
  sha256: z.string().min(1),
  sha1: z.string().min(1),
  md5: z.string().min(1),
  fileName: z.string().min(1),
  fileSize: z.number().int().nonnegative(),
  fileType: z.string().min(1),
  overallEntropy: z.number().min(0).max(8),
  truncated: z.boolean(),
  isPe: z.boolean(),
  pe: peInfoSchema.nullable(),
  stringCount: z.number().int().nonnegative(),
  iocs: z.array(iocSchema),
  notableStrings: z.array(z.string().min(1)),
  riskScore: z.number().int().min(0).max(100),
  riskReasons: z.array(z.string().min(1))
});

export const analyzerMalwareTriageRequestSchema = z.object({
  filePath: z.string().min(1),
  caseId: z.string().min(1).optional()
});
export const analyzerMalwareTriageResponseSchema = z.object({
  report: malwareTriageReportSchema,
  findings: z.array(analyzerFindingSchema)
});

export const emailHopSchema = z.object({
  index: z.number().int().min(0),
  fromHost: z.string().nullable(),
  byHost: z.string().nullable(),
  // Organization inferred from the hosts (best-effort registrable domain).
  org: z.string().nullable(),
  protocol: z.string().nullable(),
  timestamp: z.string().nullable(),
  // Delay from the previous hop in seconds; the first real hop has none.
  delaySeconds: z.number().int().nullable(),
  ip: z.string().nullable()
});

export const emailAuthResultSchema = z.object({
  spf: z.enum(emailAuthVerdictValues),
  dkim: z.enum(emailAuthVerdictValues),
  dmarc: z.enum(emailAuthVerdictValues)
});

export const emailHeaderReportSchema = z.object({
  from: z.string().nullable(),
  fromDomain: z.string().nullable(),
  returnPath: z.string().nullable(),
  returnPathDomain: z.string().nullable(),
  replyTo: z.string().nullable(),
  replyToDomain: z.string().nullable(),
  subject: z.string().nullable(),
  date: z.string().nullable(),
  messageId: z.string().nullable(),
  originatingIp: z.string().nullable(),
  originatingHost: z.string().nullable(),
  hops: z.array(emailHopSchema),
  totalTransitSeconds: z.number().int().nullable(),
  auth: emailAuthResultSchema,
  spoofingIndicators: z.array(z.string().min(1)),
  riskScore: z.number().int().min(0).max(100),
  riskReasons: z.array(z.string().min(1))
});

export const analyzerEmailHeadersRequestSchema = z.object({
  rawHeaders: z.string().min(1),
  caseId: z.string().min(1).optional()
});
export const analyzerEmailHeadersResponseSchema = z.object({
  report: emailHeaderReportSchema,
  findings: z.array(analyzerFindingSchema)
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

export const analyzerVirusTotalLookupRequestSchema = z.object({
  sha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
  fileName: z.string().min(1).optional(),
  fileSize: z.number().int().nonnegative().optional(),
  caseId: z.string().min(1).optional()
});
export const analyzerVirusTotalLookupResponseSchema = z.object({
  report: virusTotalReportSchema,
  findings: z.array(analyzerFindingSchema)
});

export type AnalyzerFinding = z.infer<typeof analyzerFindingSchema>;
export type Ioc = z.infer<typeof iocSchema>;
export type PeSection = z.infer<typeof peSectionSchema>;
export type PeImport = z.infer<typeof peImportSchema>;
export type PeInfo = z.infer<typeof peInfoSchema>;
export type MalwareTriageReport = z.infer<typeof malwareTriageReportSchema>;
export type AnalyzerMalwareTriageRequest = z.infer<typeof analyzerMalwareTriageRequestSchema>;
export type AnalyzerMalwareTriageResponse = z.infer<typeof analyzerMalwareTriageResponseSchema>;
export type EmailHop = z.infer<typeof emailHopSchema>;
export type EmailAuthResult = z.infer<typeof emailAuthResultSchema>;
export type EmailHeaderReport = z.infer<typeof emailHeaderReportSchema>;
export type AnalyzerEmailHeadersRequest = z.infer<typeof analyzerEmailHeadersRequestSchema>;
export type AnalyzerEmailHeadersResponse = z.infer<typeof analyzerEmailHeadersResponseSchema>;
export type EvtxEvent = z.infer<typeof evtxEventSchema>;
export type PcapConversation = z.infer<typeof pcapConversationSchema>;
export type DorkResult = z.infer<typeof dorkResultSchema>;
export type MacLookupResult = z.infer<typeof macLookupResultSchema>;
export type VulnerabilityRecord = z.infer<typeof vulnerabilityRecordSchema>;
export type VirusTotalDetectionStats = z.infer<typeof virusTotalDetectionStatsSchema>;
export type VirusTotalEngineResult = z.infer<typeof virusTotalEngineResultSchema>;
export type VirusTotalReport = z.infer<typeof virusTotalReportSchema>;
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
export type AnalyzerVirusTotalLookupRequest = z.infer<typeof analyzerVirusTotalLookupRequestSchema>;
export type AnalyzerVirusTotalLookupResponse = z.infer<typeof analyzerVirusTotalLookupResponseSchema>;
