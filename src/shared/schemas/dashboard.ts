/**
 * Dashboard schemas keep the home surface as a bounded read model instead of a
 * renderer-side pile of table-specific requests. If the UI queried every source
 * independently, recent activity could drift from the same audit and case state
 * that packaging reviewers need to verify.
 */
import { z } from "zod";
import { auditEventSchema } from "./audit.js";
import { agentRunRecordSchema, agentLiveStateSchema } from "./agents-runtime.js";
import { caseRecordSchema } from "./cases.js";
import { monitoringAlertSchema } from "./monitoring.js";
import { seedTypeValues } from "../types/search.js";

export const dashboardSearchRunSchema = z.object({
  id: z.string().min(1),
  seedType: z.enum(seedTypeValues),
  seedValue: z.string().min(1),
  startedTs: z.string().min(1),
  completedTs: z.string().nullable()
});

export const dashboardAgentStatusSchema = z.object({
  working: z.number().int().min(0),
  idle: z.number().int().min(0),
  offline: z.number().int().min(0),
  error: z.number().int().min(0),
  states: z.array(agentLiveStateSchema)
});

export const dashboardSummaryRequestSchema = z.object({});

export const dashboardSummaryResponseSchema = z.object({
  activeCases: z.array(caseRecordSchema),
  recentSearches: z.array(dashboardSearchRunSchema),
  recentAgentRuns: z.array(agentRunRecordSchema),
  agentStatus: dashboardAgentStatusSchema,
  watchAlerts: z.array(monitoringAlertSchema),
  recentAudit: z.array(auditEventSchema)
});

export type DashboardSearchRun = z.infer<typeof dashboardSearchRunSchema>;
export type DashboardAgentStatus = z.infer<typeof dashboardAgentStatusSchema>;
export type DashboardSummaryResponse = z.infer<typeof dashboardSummaryResponseSchema>;
