/**
 * DashboardService composes passive read models with live agent labels because
 * the home view needs one coherent snapshot without starting jobs. If summary
 * generation could launch tools or providers, simply opening the app would
 * become a hidden active operation.
 */
import type { AuditRepository } from "../../db/repositories/audit-repository.js";
import type { DashboardRepository } from "../../db/repositories/dashboard-repository.js";
import type { AgentRuntimeService } from "../agents/agent-runtime-service.js";
import type { DashboardSummaryResponse } from "../../shared/schemas/dashboard.js";

export class DashboardService {
  public constructor(
    private readonly dashboardRepository: DashboardRepository,
    private readonly auditRepository: AuditRepository,
    private readonly agentRuntimeService: AgentRuntimeService
  ) {}

  public summary(): DashboardSummaryResponse {
    const states = this.agentRuntimeService.states();
    return {
      activeCases: this.dashboardRepository.activeCases(5),
      recentSearches: this.dashboardRepository.recentSearches(6),
      recentAgentRuns: this.dashboardRepository.recentAgentRuns(6),
      agentStatus: {
        working: states.filter((state) => state.status === "working").length,
        idle: states.filter((state) => state.status === "idle").length,
        offline: states.filter((state) => state.status === "offline").length,
        error: states.filter((state) => state.status === "error").length,
        states
      },
      watchAlerts: this.dashboardRepository.watchAlerts(5),
      recentAudit: this.auditRepository.list(8)
    };
  }
}
