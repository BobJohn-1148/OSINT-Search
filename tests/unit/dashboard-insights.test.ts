/**
 * Dashboard insight numbers sit above the panels that list the same rows, so a
 * disagreement between them would undermine the whole surface. These pin the
 * posture math against explicit fixtures.
 */
import { computeDashboardInsights } from "../../src/renderer/insights/dashboard-insights";
import type { DashboardSummaryResponse } from "../../src/shared/schemas/dashboard";
import type { ExposureRecord, MonitoringAlert, WatchRecord } from "../../src/shared/schemas/monitoring";
import type { CaseRecord } from "../../src/shared/schemas/cases";

const emptySummary: DashboardSummaryResponse = {
  activeCases: [],
  recentSearches: [],
  recentAgentRuns: [],
  agentStatus: { working: 0, idle: 0, offline: 0, error: 0, states: [] },
  watchAlerts: [],
  recentAudit: []
};

function watch(overrides: Partial<WatchRecord>): WatchRecord {
  return {
    id: "w",
    type: "email",
    value: "a@b.com",
    caseId: null,
    checkIntervalMinutes: 60,
    createdTs: "2026-08-15T10:00:00.000Z",
    lastCheckedTs: "2026-08-15T10:30:00.000Z",
    ...overrides
  };
}

it("median search duration ignores still-running searches so an open search cannot skew timing", () => {
  const insights = computeDashboardInsights({
    summary: {
      ...emptySummary,
      recentSearches: [
        { id: "s1", seedType: "domain", seedValue: "a.com", startedTs: "2026-08-15T10:00:00.000Z", completedTs: "2026-08-15T10:00:02.000Z" },
        { id: "s2", seedType: "domain", seedValue: "b.com", startedTs: "2026-08-15T10:00:00.000Z", completedTs: "2026-08-15T10:00:06.000Z" },
        { id: "s3", seedType: "email", seedValue: "x@y.com", startedTs: "2026-08-15T10:00:00.000Z", completedTs: null }
      ]
    },
    cases: [],
    watches: [],
    alerts: [],
    exposures: []
  });

  expect(insights.searchesTracked).toBe(3);
  expect(insights.searchesInFlight).toBe(1);
  expect(insights.medianSearchMs).toBe(4000);
  expect(insights.seedMix[0]).toEqual({ label: "domain", count: 2, share: 2 / 3 });
});

it("monitoring posture separates unchecked watches and unacknowledged alerts so gaps are visible", () => {
  const alerts: MonitoringAlert[] = [
    { id: "a1", exposureId: "e1", watchId: "w1", message: "leaked", createdTs: "2026-08-15T10:00:00.000Z", acknowledgedTs: null },
    { id: "a2", exposureId: "e2", watchId: "w1", message: "seen", createdTs: "2026-08-15T10:00:00.000Z", acknowledgedTs: "2026-08-15T11:00:00.000Z" }
  ];
  const exposures: ExposureRecord[] = [
    { id: "e1", watchId: "w1", source: "xposedornot", title: "Acme", detail: "d", fingerprint: "f1", firstSeenTs: "2026-08-15T10:00:00.000Z", lastSeenTs: "2026-08-15T10:00:00.000Z" },
    { id: "e2", watchId: "w1", source: "xposedornot", title: "Beta", detail: "d", fingerprint: "f2", firstSeenTs: "2026-08-15T10:00:00.000Z", lastSeenTs: "2026-08-15T10:00:00.000Z" }
  ];

  const insights = computeDashboardInsights({
    summary: emptySummary,
    cases: [],
    watches: [watch({ id: "w1" }), watch({ id: "w2", lastCheckedTs: null })],
    alerts,
    exposures
  });

  expect(insights.watchCount).toBe(2);
  expect(insights.neverCheckedWatches).toBe(1);
  expect(insights.openAlerts).toBe(1);
  expect(insights.exposureCount).toBe(2);
  expect(insights.exposureSources[0]).toEqual({ label: "xposedornot", count: 2, share: 1 });
});

it("case load counts only open cases so an archive does not inflate active work", () => {
  const cases: CaseRecord[] = [
    { id: "c1", title: "Open one", status: "open", createdTs: "2026-08-15T10:00:00.000Z", updatedTs: "2026-08-15T10:00:00.000Z", tags: [] },
    { id: "c2", title: "Archived one", status: "archived", createdTs: "2026-08-15T10:00:00.000Z", updatedTs: "2026-08-15T10:00:00.000Z", tags: [] }
  ];

  const insights = computeDashboardInsights({ summary: emptySummary, cases, watches: [], alerts: [], exposures: [] });

  expect(insights.openCases).toBe(1);
  expect(insights.totalCases).toBe(2);
});

it("high-sensitivity audit events are counted separately so routine noise does not hide them", () => {
  const insights = computeDashboardInsights({
    summary: {
      ...emptySummary,
      agentStatus: { working: 2, idle: 1, offline: 3, error: 0, states: [] },
      recentAudit: [
        { id: 1, ts: "2026-08-15T10:00:00.000Z", actor: "local-user", action: "key.read", objectType: "vault", objectId: "openai", sensitivity: "high", detail: {} },
        { id: 2, ts: "2026-08-15T10:00:00.000Z", actor: "local-user", action: "key.read", objectType: "vault", objectId: "openai", sensitivity: "high", detail: {} },
        { id: 3, ts: "2026-08-15T10:00:00.000Z", actor: "local-user", action: "system.ping", objectType: "system", objectId: "ping", sensitivity: "low", detail: {} }
      ]
    },
    cases: [],
    watches: [],
    alerts: [],
    exposures: []
  });

  expect(insights.sensitiveAuditEvents).toBe(2);
  expect(insights.auditActions[0]).toEqual({ label: "key.read", count: 2, share: 2 / 3 });
  // Offline agents are deliberately excluded: "online" means reachable now.
  expect(insights.agentsOnline).toBe(3);
});

it("a missing summary degrades to zeros so the dashboard renders before the first load returns", () => {
  const insights = computeDashboardInsights({ summary: null, cases: [], watches: [], alerts: [], exposures: [] });

  expect(insights.searchesTracked).toBe(0);
  expect(insights.medianSearchMs).toBeNull();
  expect(insights.agentsOnline).toBe(0);
  expect(insights.seedMix).toEqual([]);
});
