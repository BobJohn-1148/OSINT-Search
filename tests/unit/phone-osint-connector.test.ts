/**
 * The phone connector is the answer to "a phone search returned domain tools":
 * it must only claim what the number and the local table prove, and it must hand
 * off reverse-lookup tools seeded with the actual number. These pin the derived
 * facts (region, E.164, NANP validity) and that every tool link carries a usable
 * lookupUrl the search UI can open.
 */
import { phoneOsintConnector } from "../../src/main/search/connectors/phone-osint-connector";
import type { SourceRunContext } from "../../src/main/search/source-connector";

const context: SourceRunContext = { fetchJson: () => Promise.resolve(null) };

async function run(value: string) {
  return phoneOsintConnector.run({ type: "phone", value }, context);
}

it("only supports the phone seed so it never runs on unrelated seeds", () => {
  expect(phoneOsintConnector.supports("phone")).toBe(true);
  expect(phoneOsintConnector.supports("domain")).toBe(false);
  expect(phoneOsintConnector.supports("ip")).toBe(false);
});

it("derives region, E.164, and NANP validity from a US number using the local table", async () => {
  const observations = await run("7792428305");

  const format = observations.find((observation) => observation.type === "phone-format");
  expect(format?.value).toContain("+17792428305");
  expect(format?.raw?.isNanp).toBe(true);
  expect(format?.raw?.areaCode).toBe("779");

  const region = observations.find((observation) => observation.type === "phone-region");
  expect(region?.value).toBe("Area code 779 — Illinois");
});

it("normalizes formatted input the same as bare digits so punctuation does not matter", async () => {
  const pretty = await run("(779) 242-8305");
  const format = pretty.find((observation) => observation.type === "phone-format");
  expect(format?.raw?.e164).toBe("+17792428305");
});

it("hands off reverse-lookup tools seeded with the number so the phone actually gets run through OSINT", async () => {
  const observations = await run("7792428305");
  const tools = observations.filter((observation) => observation.type === "phone-osint-tool");

  expect(tools.length).toBeGreaterThanOrEqual(10);
  // Every tool observation must carry an https lookup URL the UI can open.
  for (const tool of tools) {
    expect(String(tool.raw?.lookupUrl)).toMatch(/^https:\/\//);
  }
  const truecaller = tools.find((observation) => observation.raw?.tool === "truecaller");
  expect(String(truecaller?.raw?.lookupUrl)).toContain("7792428305");
});

it("does not claim a region for an area code outside the local table but still runs the tools", async () => {
  // 999 is not an assigned NANP area code, so no region is asserted.
  const observations = await run("9992428305");
  const region = observations.find((observation) => observation.type === "phone-region");
  expect(region?.value).toContain("region not in local table");
  expect(observations.some((observation) => observation.type === "phone-osint-tool")).toBe(true);
});

it("reports an unparseable number honestly instead of inventing data", async () => {
  const observations = await run("abc");
  expect(observations).toHaveLength(1);
  expect(observations[0].raw?.valid).toBe(false);
});
