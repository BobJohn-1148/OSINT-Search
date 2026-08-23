/**
 * Topology layout is deterministic and hand-rolled because scans of the same
 * target need to line up by eye across time. If the renderer library chose node
 * positions, comparisons would shift for reasons unrelated to the network.
 */
import type { ScanHost, ScanTopology } from "../../shared/schemas/scans.js";

const RING_RADIUS = 170;

export function buildScanTopology(scanId: string, target: string, hosts: readonly ScanHost[]): ScanTopology {
  const nodes = [
    { id: "target", label: target, x: 0, y: 0, ring: 0 },
    ...hosts.map((host) => positionHost(host))
  ];
  const edges = hosts.map((host) => ({ id: `target-${host.id}`, source: "target", target: host.id }));
  return { scanId, nodes, edges };
}

function positionHost(host: ScanHost): { readonly id: string; readonly label: string; readonly x: number; readonly y: number; readonly ring: number } {
  const ring = Math.max(1, host.hopDistance);
  const hash = hashAddress(host.address);
  const angle = (hash % 360) * (Math.PI / 180);
  const radius = ring * RING_RADIUS;
  return {
    id: host.id,
    label: host.hostname ? `${host.hostname} (${host.address})` : host.address,
    x: Math.round(Math.cos(angle) * radius),
    y: Math.round(Math.sin(angle) * radius),
    ring
  };
}

function hashAddress(address: string): number {
  let hash = 2166136261;
  for (const character of address) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
