/**
 * Topology layout tests protect visual comparability because nmap scans should
 * move only when the network changes. If layout randomness enters here, two
 * identical scans would be hard to compare by eye.
 */
import { buildScanTopology } from "../../src/main/scans/topology-layout";
import type { ScanHost } from "../../src/shared/schemas/scans";

const hosts: ScanHost[] = [
  {
    id: "host-one",
    scanId: "scan-one",
    address: "192.168.1.10",
    hostname: "workstation.local",
    status: "up",
    hopDistance: 1,
    ports: []
  },
  {
    id: "host-two",
    scanId: "scan-one",
    address: "192.168.1.20",
    hostname: null,
    status: "up",
    hopDistance: 2,
    ports: []
  }
];

it("lays out topology deterministically for identical input so scan comparisons stay stable", () => {
  const first = buildScanTopology("scan-one", "192.168.1.0/24", hosts);
  const second = buildScanTopology("scan-one", "192.168.1.0/24", hosts);

  expect(first).toEqual(second);
  expect(first.nodes.map((node) => [node.id, node.ring])).toEqual([["target", 0], ["host-one", 1], ["host-two", 2]]);
});
