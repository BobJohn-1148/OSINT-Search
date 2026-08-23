/**
 * Provider handlers test configuration through the vault gate so external
 * adapters never receive keys that were not audited on read. If provider checks
 * queried api_keys directly, successful tests could leave no audit trail.
 */
import type { VaultRepository } from "../../../db/repositories/vault-repository.js";
import type {
  ProvidersListResponse,
  ProvidersTestRequest,
  ProvidersTestResponse
} from "../../../shared/schemas/providers.js";
import { getProviderAdapter, providerAdapters } from "../../providers/provider-adapters.js";

export function createProvidersHandlers(vaultRepository: VaultRepository) {
  return {
    "providers:list": (): ProvidersListResponse => ({
      providers: providerAdapters.map((adapter) => ({
        id: adapter.id,
        label: adapter.label,
        keySource: adapter.keySource,
        requiresKey: adapter.requiresKey,
        configured: adapter.keySource ? vaultRepository.has(adapter.keySource) : true,
        defaultModel: adapter.defaultModel,
        availableModels: [...adapter.availableModels],
        supportedEfforts: [...adapter.supportedEfforts]
      }))
    }),
    "providers:test": (request: ProvidersTestRequest): ProvidersTestResponse => {
      const adapter = getProviderAdapter(request.provider);
      const secret = adapter.keySource
        ? vaultRepository.readSecret(adapter.keySource, "local-user", "provider.test")
        : null;
      const result = adapter.testConnection({ secret, model: adapter.defaultModel });
      return {
        provider: request.provider,
        model: adapter.defaultModel,
        ...result
      };
    }
  };
}
