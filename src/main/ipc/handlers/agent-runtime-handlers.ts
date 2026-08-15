/**
 * Agent runtime handlers keep long-running work in main and expose only typed
 * summaries to the renderer. If the HQ scene called tools or providers itself,
 * stability and audit guarantees would vanish behind a canvas loop.
 */
import type { AgentRuntimeRepository } from "../../../db/repositories/agent-runtime-repository.js";
import type {
  AgentMemoryListRequest,
  AgentMemoryListResponse,
  AgentPlaybooksResponse,
  AgentRunRequest,
  AgentRunResponse,
  AgentRunsRequest,
  AgentRunsResponse,
  AgentStatesResponse
} from "../../../shared/schemas/agents-runtime.js";
import type { AgentRuntimeService } from "../../agents/agent-runtime-service.js";

export function createAgentRuntimeHandlers(
  agentRuntimeService: AgentRuntimeService,
  agentRuntimeRepository: AgentRuntimeRepository
) {
  return {
    "agent:run": (request: AgentRunRequest): Promise<AgentRunResponse> => agentRuntimeService.run(request),
    "agent:runs": (request: AgentRunsRequest): AgentRunsResponse => ({
      runs: agentRuntimeRepository.listRuns(request.agentId)
    }),
    "agent:memory:list": (request: AgentMemoryListRequest): AgentMemoryListResponse => ({
      memory: agentRuntimeRepository.listMemory(request.scope, request.limit)
    }),
    "agent:states": (): AgentStatesResponse => ({
      states: agentRuntimeService.states()
    }),
    "agent:playbooks": (): AgentPlaybooksResponse => ({
      playbooks: agentRuntimeRepository.listPlaybooks()
    })
  };
}
