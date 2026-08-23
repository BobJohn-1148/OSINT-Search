/**
 * Key handlers are thin because the vault repository owns encryption and audited
 * reads. If handlers touched ciphertext or returned decrypted values, the
 * renderer boundary would become a credential leak path.
 */
import type { AuditRepository } from "../../../db/repositories/audit-repository.js";
import type { VaultRepository } from "../../../db/repositories/vault-repository.js";
import type {
  KeysAddRequest,
  KeysAddResponse,
  KeysListResponse,
  KeysRevokeRequest,
  KeysRevokeResponse,
  KeysTestRequest,
  KeysTestResponse
} from "../../../shared/schemas/keys.js";
import { providerAdapters } from "../../providers/provider-adapters.js";

export function createKeysHandlers(vaultRepository: VaultRepository, auditRepository: AuditRepository) {
  return {
    "keys:add": (request: KeysAddRequest): KeysAddResponse => {
      const key = vaultRepository.add(request.source, request.secret);
      auditRepository.record({
        actor: "local-user",
        action: "key.add",
        objectType: "api_key",
        objectId: request.source,
        sensitivity: "sensitive",
        detail: { source: request.source }
      });
      return { key };
    },
    "keys:test": (request: KeysTestRequest): KeysTestResponse => {
      const secret = vaultRepository.readSecret(request.source, "local-user", "key.test");
      const adapter = providerAdapters.find((candidate) => candidate.keySource === request.source);
      if (!adapter) {
        return {
          source: request.source,
          ok: secret.length > 0,
          message: `${request.source} key decrypts through the vault gate`
        };
      }

      const result = adapter.testConnection({ secret, model: adapter.defaultModel });
      return { source: request.source, ...result };
    },
    "keys:revoke": (request: KeysRevokeRequest): KeysRevokeResponse => {
      const revoked = vaultRepository.revoke(request.source);
      auditRepository.record({
        actor: "local-user",
        action: "key.revoke",
        objectType: "api_key",
        objectId: request.source,
        sensitivity: "sensitive",
        detail: { source: request.source, revoked }
      });
      return { source: request.source, revoked };
    },
    "keys:list": (): KeysListResponse => ({
      keys: vaultRepository.list()
    })
  };
}
