/**
 * VirusTotal normalization stays separate from the service so API response
 * drift is caught before renderer and case evidence code depend on raw fields.
 */
import type {
  AnalyzerVirusTotalLookupRequest,
  VirusTotalDetectionStats,
  VirusTotalEngineResult,
  VirusTotalReport
} from "../../shared/schemas/analyzers.js";
import type { JsonFetcher } from "./analyzers-service.js";

interface VirusTotalLookupMetadata {
  readonly sha256: string;
  readonly fileName?: string | undefined;
  readonly fileSize?: number | undefined;
}

type StatsKey =
  | "malicious"
  | "suspicious"
  | "harmless"
  | "undetected"
  | "timeout"
  | "confirmed-timeout"
  | "failure"
  | "type-unsupported";

export async function fetchVirusTotalFileReport(
  request: AnalyzerVirusTotalLookupRequest,
  apiKey: string,
  fetchJson: JsonFetcher
): Promise<VirusTotalReport> {
  const sha256 = request.sha256.toLowerCase();
  const response = await fetchJson(`https://www.virustotal.com/api/v3/files/${encodeURIComponent(sha256)}`, {
    headers: {
      accept: "application/json",
      "x-apikey": apiKey
    }
  });

  return parseVirusTotalFileReport(response, request);
}

export function parseVirusTotalFileReport(
  response: unknown,
  request: VirusTotalLookupMetadata
): VirusTotalReport {
  const root = expectRecord(response, "VirusTotal response");
  const data = expectRecord(root.data, "VirusTotal response data");
  const attributes = expectRecord(data.attributes, "VirusTotal file attributes");
  const links = isRecord(data.links) ? data.links : {};
  const stats = normalizeStats(attributes.last_analysis_stats);
  const detections = normalizeDetections(attributes.last_analysis_results);
  const sha256 = stringValue(attributes.sha256) ?? request.sha256.toLowerCase();
  const names = stringArray(attributes.names);
  const fileName = firstNonEmpty(request.fileName, stringValue(attributes.meaningful_name), names[0], stringValue(attributes.magic), sha256);

  return {
    id: stringValue(data.id) ?? sha256,
    sha256,
    sha1: stringValue(attributes.sha1),
    md5: stringValue(attributes.md5),
    fileName,
    fileSize: numberValue(attributes.size) ?? request.fileSize ?? null,
    typeDescription: stringValue(attributes.type_description),
    meaningfulName: stringValue(attributes.meaningful_name),
    magic: stringValue(attributes.magic),
    reputation: numberValue(attributes.reputation),
    firstSubmissionTs: secondsToIso(attributes.first_submission_date),
    lastAnalysisTs: secondsToIso(attributes.last_analysis_date),
    lastModificationTs: secondsToIso(attributes.last_modification_date),
    detectionStats: stats,
    topDetections: detections,
    names,
    tags: stringArray(attributes.tags),
    threatLabel: threatLabel(attributes.popular_threat_classification),
    guiUrl: `https://www.virustotal.com/gui/file/${sha256}`,
    apiUrl: stringValue(links.self) ?? `https://www.virustotal.com/api/v3/files/${sha256}`,
    rawJson: root
  };
}

function normalizeStats(value: unknown): VirusTotalDetectionStats {
  const stats = isRecord(value) ? value : {};
  return {
    malicious: statNumber(stats, "malicious"),
    suspicious: statNumber(stats, "suspicious"),
    harmless: statNumber(stats, "harmless"),
    undetected: statNumber(stats, "undetected"),
    timeout: statNumber(stats, "timeout"),
    confirmedTimeout: statNumber(stats, "confirmed-timeout"),
    failure: statNumber(stats, "failure"),
    typeUnsupported: statNumber(stats, "type-unsupported")
  };
}

function normalizeDetections(value: unknown): VirusTotalEngineResult[] {
  if (!isRecord(value)) {
    return [];
  }

  return Object.entries(value)
    .flatMap(([fallbackName, raw]) => {
      if (!isRecord(raw)) {
        return [];
      }
      const category = stringValue(raw.category) ?? "unknown";
      if (category === "undetected" || category === "harmless" || category === "type-unsupported") {
        return [];
      }
      return [{
        engineName: stringValue(raw.engine_name) ?? fallbackName,
        category,
        result: stringValue(raw.result),
        method: stringValue(raw.method),
        engineVersion: stringValue(raw.engine_version),
        engineUpdate: stringValue(raw.engine_update)
      }];
    })
    .sort((left, right) => detectionRank(left.category) - detectionRank(right.category) || left.engineName.localeCompare(right.engineName))
    .slice(0, 24);
}

function detectionRank(category: string): number {
  if (category === "malicious") {
    return 0;
  }
  if (category === "suspicious") {
    return 1;
  }
  return 2;
}

function statNumber(stats: Record<string, unknown>, key: StatsKey): number {
  const value = stats[key];
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
}

function threatLabel(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }
  return stringValue(value.suggested_threat_label);
}

function secondsToIso(value: unknown): string | null {
  const seconds = numberValue(value);
  return seconds === null ? null : new Date(seconds * 1000).toISOString();
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function firstNonEmpty(...values: readonly (string | null | undefined)[]): string {
  return values.find((value): value is string => typeof value === "string" && value.length > 0) ?? "";
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} is missing or invalid`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
