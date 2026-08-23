/**
 * PCAP parser tests treat tshark output as a fixture because Phase 9 imports
 * capture files only. If argv construction grew a capture-interface flag,
 * Reacher could start sniffing instead of analyzing a selected file.
 */
import { buildTsharkArgv, parseTsharkJson } from "../../src/main/analyzers/pcap-parser";

const tsharkJson = JSON.stringify([
  {
    _source: {
      layers: {
        "ip.src": "10.0.0.5",
        "ip.dst": "10.0.0.10",
        "_ws.col.Protocol": "TLS",
        "frame.len": "120"
      }
    }
  },
  {
    _source: {
      layers: {
        "ip.src": "10.0.0.5",
        "ip.dst": "10.0.0.10",
        "_ws.col.Protocol": "TLS",
        "frame.len": "80"
      }
    }
  }
]);

it("pcap parser reads a fixture and never exposes a live capture argv so packet imports stay file only", () => {
  expect(buildTsharkArgv("sample.pcapng")).toEqual(["tshark", "-r", "sample.pcapng", "-T", "json"]);
  expect(buildTsharkArgv("sample.pcapng")).not.toContain("-i");
  expect(parseTsharkJson(tsharkJson)).toEqual([
    {
      source: "10.0.0.5",
      destination: "10.0.0.10",
      protocol: "TLS",
      packets: 2,
      bytes: 200
    }
  ]);
});
