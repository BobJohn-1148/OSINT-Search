/**
 * Analyzer handlers keep five distinct tools behind typed IPC so imports and
 * lookups cannot bypass parser or save-to-case policy. If analyzer calls were
 * routed ad hoc, file analyzers could grow unsafe process paths unnoticed.
 */
import type {
  AnalyzerDorkBuildRequest,
  AnalyzerDorkBuildResponse,
  AnalyzerEmailHeadersRequest,
  AnalyzerEmailHeadersResponse,
  AnalyzerEvtxImportRequest,
  AnalyzerEvtxImportResponse,
  AnalyzerMacLookupRequest,
  AnalyzerMacLookupResponse,
  AnalyzerMalwareTriageRequest,
  AnalyzerMalwareTriageResponse,
  AnalyzerPcapImportRequest,
  AnalyzerPcapImportResponse,
  AnalyzerVirusTotalLookupRequest,
  AnalyzerVirusTotalLookupResponse,
  AnalyzerVulnLookupRequest,
  AnalyzerVulnLookupResponse
} from "../../../shared/schemas/analyzers.js";
import type { AnalyzersService } from "../../analyzers/analyzers-service.js";

export function createAnalyzersHandlers(analyzersService: AnalyzersService) {
  return {
    "analyzer:evtx:import": async (request: AnalyzerEvtxImportRequest): Promise<AnalyzerEvtxImportResponse> =>
      analyzersService.importEvtx(request),
    "analyzer:pcap:import": async (request: AnalyzerPcapImportRequest): Promise<AnalyzerPcapImportResponse> =>
      analyzersService.importPcap(request),
    "analyzer:dork:build": (request: AnalyzerDorkBuildRequest): AnalyzerDorkBuildResponse =>
      analyzersService.buildDorks(request),
    "analyzer:mac:lookup": async (request: AnalyzerMacLookupRequest): Promise<AnalyzerMacLookupResponse> =>
      analyzersService.lookupMac(request),
    "analyzer:vuln:lookup": async (request: AnalyzerVulnLookupRequest): Promise<AnalyzerVulnLookupResponse> =>
      analyzersService.lookupVulnerabilities(request),
    "analyzer:virustotal:lookup": async (request: AnalyzerVirusTotalLookupRequest): Promise<AnalyzerVirusTotalLookupResponse> =>
      analyzersService.lookupVirusTotal(request),
    "analyzer:malware:triage": async (request: AnalyzerMalwareTriageRequest): Promise<AnalyzerMalwareTriageResponse> =>
      analyzersService.triageMalware(request),
    "analyzer:email:headers": (request: AnalyzerEmailHeadersRequest): AnalyzerEmailHeadersResponse =>
      analyzersService.analyzeEmailHeaders(request)
  };
}
