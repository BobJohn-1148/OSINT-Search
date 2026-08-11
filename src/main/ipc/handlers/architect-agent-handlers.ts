/**
 * Architect handlers keep Codex-style actions behind main-process services
 * because renderer buttons must not decide what is safe to write. If apply logic
 * lived in React, a compromised route could skip confirmation and audit.
 */
import type {
  ArchitectApplyRequest,
  ArchitectApplyResponse,
  ArchitectAskRequest,
  ArchitectAskResponse,
  ArchitectProposePlanRequest,
  ArchitectProposePlanResponse
} from "../../../shared/schemas/architect-agent.js";
import type { ArchitectAgentService } from "../../agents/architect-agent-service.js";

export function createArchitectAgentHandlers(architectAgentService: ArchitectAgentService) {
  return {
    "agent:architect:ask": (request: ArchitectAskRequest): ArchitectAskResponse => architectAgentService.ask(request),
    "agent:architect:proposePlan": (request: ArchitectProposePlanRequest): ArchitectProposePlanResponse =>
      architectAgentService.proposePlan(request),
    "agent:architect:apply": (request: ArchitectApplyRequest): Promise<ArchitectApplyResponse> =>
      architectAgentService.apply(request)
  };
}
