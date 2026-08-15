/**
 * System handlers prove the Phase 0 audit path with a deliberately small action.
 * If the first stub action did not write audit data, later features would have
 * no working example for sensitive-action logging.
 */
import type { AuditRepository } from "../../../db/repositories/audit-repository.js";
import type {
  SystemPickImageResponse,
  SystemPingRequest,
  SystemPingResponse
} from "../../../shared/schemas/system.js";

export type PickImageDialog = () => Promise<string | null>;

export function createSystemHandlers(auditRepository: AuditRepository, pickImageDialog: PickImageDialog = () => Promise.resolve(null)) {
  return {
    "system:ping": (request: SystemPingRequest): SystemPingResponse => {
      auditRepository.record({
        actor: "local-user",
        action: "system.ping",
        objectType: "system",
        objectId: "reacher",
        sensitivity: "low",
        detail: { nonce: request.nonce }
      });

      return { pong: true, nonce: request.nonce, audited: true };
    },
    "system:pickImage": async (): Promise<SystemPickImageResponse> => ({
      imagePath: await pickImageDialog()
    })
  };
}
