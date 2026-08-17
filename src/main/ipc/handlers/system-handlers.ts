/**
 * System handlers prove the Phase 0 audit path with a deliberately small action.
 * If the first stub action did not write audit data, later features would have
 * no working example for sensitive-action logging.
 */
import type { AuditRepository } from "../../../db/repositories/audit-repository.js";
import type {
  SystemLocalNetworksResponse,
  SystemPickImageResponse,
  SystemPingRequest,
  SystemPingResponse
} from "../../../shared/schemas/system.js";
import { networkInterfaces } from "node:os";

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
    }),
    "system:localNetworks": (): SystemLocalNetworksResponse => ({
      networks: localNetworks()
    })
  };
}

function localNetworks(): SystemLocalNetworksResponse["networks"] {
  const networks: SystemLocalNetworksResponse["networks"] = [];
  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== "IPv4" || address.internal || !isUsableLocalIpv4(address.address)) {
        continue;
      }
      const octets = address.address.split(".");
      if (octets.length !== 4) {
        continue;
      }
      networks.push({
        name,
        address: address.address,
        cidr: `${octets[0]}.${octets[1]}.${octets[2]}.0/24`
      });
    }
  }
  return networks;
}

export function isUsableLocalIpv4(address: string): boolean {
  const octets = address.split(".").map((part) => Number(part));
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [first, second] = octets;
  return first !== 0 && first !== 127 && !(first === 169 && second === 254) && first !== 255;
}
