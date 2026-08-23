/**
 * This is the end-to-end proof that a phone search actually works now: it runs
 * the real orchestrator over the real connector registry with a real number, and
 * asserts the fix from both sides — the phone connector produces useful evidence,
 * and the domain/cert/IP connectors that used to flood a phone search do NOT run.
 * A phone seed reaching crtsh or rdap would be the exact regression this guards.
 */
import { searchConnectors } from "../../src/main/search/connectors";
import { runSearch } from "../../src/main/search/orchestrator";

// The user's own number, used deliberately so this test tracks the real case
// that motivated the phone connector.
const PHONE = "7792428305";

it("runs a real phone search that returns only phone-relevant OSINT, not domain tools", async () => {
  const result = await runSearch({
    seed: { type: "phone", value: PHONE },
    connectors: searchConnectors
  });

  const returnedSources = result.statuses.map((status) => status.sourceId);
  // The phone connector is the only source that should participate at all.
  expect(returnedSources).toEqual(["phone-osint"]);
  // Guard against the original bug: none of the domain/cert/IP connectors run.
  for (const domainSource of ["rdap", "crtsh", "dns-doh", "shodan-internetdb", "ipinfo"]) {
    expect(returnedSources).not.toContain(domainSource);
  }
});

it("resolves the real number to its E.164, Illinois region, and openable lookup tools", async () => {
  const result = await runSearch({
    seed: { type: "phone", value: PHONE },
    connectors: searchConnectors
  });

  const values = result.observations.map((observation) => observation.value);
  expect(values).toContain("+17792428305 (valid NANP)");
  expect(values).toContain("Area code 779 — Illinois");

  const tools = result.observations.filter((observation) => observation.type === "phone-osint-tool");
  expect(tools.length).toBeGreaterThanOrEqual(10);
  for (const tool of tools) {
    expect(String(tool.raw?.lookupUrl)).toMatch(/^https:\/\//);
  }
  // Truecaller's handoff must carry the actual number so the click lands on it.
  expect(tools.some((tool) => String(tool.raw?.lookupUrl).includes(PHONE))).toBe(true);
});

it("builds a correlation tree rooted at the phone seed so the results are saveable evidence", async () => {
  const result = await runSearch({
    seed: { type: "phone", value: PHONE },
    connectors: searchConnectors
  });

  expect(result.tree.kind).toBe("root");
  // The phone-osint source node hangs under the root with its observations as leaves.
  const sourceNode = result.tree.children.find((child) => child.sourceId === "phone-osint");
  expect(sourceNode).toBeDefined();
  expect((sourceNode?.children.length ?? 0)).toBeGreaterThanOrEqual(10);
});
