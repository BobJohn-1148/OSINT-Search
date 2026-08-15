/**
 * Agent handlers validate provider/model choices against adapters before writing
 * them because the future runtime will trust these rows. If Settings accepted
 * arbitrary model strings, Phase 5 could fail only when an agent starts running.
 */
import type { AgentsRepository } from "../../../db/repositories/agents-repository.js";
import type {
  AgentsListResponse,
  AgentsSetModelRequest,
  AgentsSetModelResponse
} from "../../../shared/schemas/agents.js";
import { getProviderAdapter } from "../../providers/provider-adapters.js";

export function createAgentsHandlers(agentsRepository: AgentsRepository) {
  return {
    "agents:list": (): AgentsListResponse => ({
      agents: agentsRepository.list()
    }),
    "agents:setModel": (request: AgentsSetModelRequest): AgentsSetModelResponse => {
      const adapter = getProviderAdapter(request.provider);
      if (!adapter.availableModels.includes(request.model)) {
        throw new Error(`${request.model} is not available for ${adapter.label}`);
      }

      return {
        agent: agentsRepository.setModel(request.agentId, request.provider, request.model)
      };
    }
  };
}
