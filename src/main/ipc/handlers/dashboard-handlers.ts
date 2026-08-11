/**
 * Dashboard handlers stay narrow because the home view is a read-only summary,
 * not a feature owner. If this handler accepted broad commands, a low-risk
 * landing surface could accidentally become an unaudited mutation path.
 */
import type { DashboardService } from "../../dashboard/dashboard-service.js";
import type { DashboardSummaryResponse } from "../../../shared/schemas/dashboard.js";

export function createDashboardHandlers(dashboardService: DashboardService) {
  return {
    "dashboard:summary": (): DashboardSummaryResponse => dashboardService.summary()
  };
}
