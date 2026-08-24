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

it("rejects empty tshark output with a clear message instead of a raw JSON syntax error", () => {
  expect(() => parseTsharkJson("")).toThrow(/no parseable JSON output/);
});

it("surfaces tshark's own reported error instead of throwing 'not iterable' on a non-array response", () => {
  expect(() => parseTsharkJson(JSON.stringify({ error: "capture file has no packets" }))).toThrow(
    /tshark reported an error instead of packet data: capture file has no packets/
  );
});

it("rejects a single un-wrapped packet object with a shape error instead of crashing on iteration", () => {
  expect(() => parseTsharkJson(JSON.stringify({ _source: { layers: {} } }))).toThrow(/was not a JSON array of packets/);
});
