/**
 * Dashboard insights summarize posture across searches, monitoring, cases, and
 * the audit trail. They are derived from the bounded dashboard read model rather
 * than new queries so the headline numbers cannot disagree with the panels
 * printed directly beneath them.
 */
import type { AuditEvent } from "../../shared/schemas/audit";
import type { CaseRecord } from "../../shared/schemas/cases";
import type { DashboardSummaryResponse } from "../../shared/schemas/dashboard";
import type { ExposureRecord, MonitoringAlert, WatchRecord } from "../../shared/schemas/monitoring";
import { elapsedMs, median, tally, type DistributionSlice } from "./metrics";

export interface DashboardInsights {
  readonly openCases: number;
  readonly totalCases: number;
  readonly searchesTracked: number;
  readonly medianSearchMs: number | null;
  readonly searchesInFlight: number;
  readonly seedMix: readonly DistributionSlice[];
  readonly watchCount: number;
  readonly neverCheckedWatches: number;
  readonly exposureCount: number;
  readonly openAlerts: number;
  readonly exposureSources: readonly DistributionSlice[];
  readonly sensitiveAuditEvents: number;
  readonly auditActions: readonly DistributionSlice[];
  readonly agentsOnline: number;
}

export function computeDashboardInsights(input: {
  readonly summary: DashboardSummaryResponse | null;
  readonly cases: readonly CaseRecord[];
  readonly watches: readonly WatchRecord[];
  readonly alerts: readonly MonitoringAlert[];
  readonly exposures: readonly ExposureRecord[];
}): DashboardInsights {
  const { summary, cases, watches, alerts, exposures } = input;
  const searches = summary?.recentSearches ?? [];
  const audit: readonly AuditEvent[] = summary?.recentAudit ?? [];
  const agentStatus = summary?.agentStatus;

  const searchDurations = searches
    .map((search) => elapsedMs(search.startedTs, search.completedTs))
    .filter((duration): duration is number => duration !== null);

  return {
    openCases: cases.filter((item) => item.status === "open").length,
    totalCases: cases.length,
    searchesTracked: searches.length,
    medianSearchMs: median(searchDurations),
    searchesInFlight: searches.filter((search) => search.completedTs === null).length,
    seedMix: tally(searches.map((search) => search.seedType)),
    watchCount: watches.length,
    neverCheckedWatches: watches.filter((watch) => watch.lastCheckedTs === null).length,
    exposureCount: exposures.length,
    openAlerts: alerts.filter((alert) => alert.acknowledgedTs === null).length,
    exposureSources: tally(exposures.map((exposure) => exposure.source)),
    sensitiveAuditEvents: audit.filter((event) => event.sensitivity === "high").length,
    auditActions: tally(audit.map((event) => event.action)),
    agentsOnline: agentStatus === undefined ? 0 : agentStatus.working + agentStatus.idle
  };
}
