/**
 * Agent handlers validate provider/model choices against adapters before writing
 * them because the future runtime will trust these rows. If Settings accepted
 * arbitrary model strings, Phase 5 could fail only when an agent starts running.
 */
import type { AgentsRepository } from "../../../db/repositories/agents-repository.js";
import type {
  AgentsListResponse,
  AgentsSetEffortRequest,
  AgentsSetEffortResponse,
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
    },
    "agents:setEffort": (request: AgentsSetEffortRequest): AgentsSetEffortResponse => {
      // Validate against the agent's *current* provider so an effort rung can
      // never be stored that the provider does not actually expose. Clearing to
      // null (provider default) is always allowed.
      if (request.reasoningEffort !== null) {
        const agent = agentsRepository.get(request.agentId);
        const adapter = getProviderAdapter(agent.provider);
        if (!adapter.supportedEfforts.includes(request.reasoningEffort)) {
          throw new Error(`${adapter.label} does not support ${request.reasoningEffort} reasoning effort`);
        }
      }

      return {
        agent: agentsRepository.setReasoningEffort(request.agentId, request.reasoningEffort)
      };
    }
  };
}
