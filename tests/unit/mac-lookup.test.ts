/**
 * MAC lookup tests pin offline OUI behavior because hardware fingerprints
 * should resolve locally when the bundled table has a match. If this regressed,
 * simple lookups would start disclosing MAC prefixes to a public service.
 */
import { lookupMacVendor, normalizeMac } from "../../src/main/analyzers/mac-lookup";

it("MAC lookup resolves an offline vendor so clean OUI data is used before any fallback", async () => {
  const fallback = vi.fn();

  await expect(lookupMacVendor("00:16:3e:00:00:01", fallback)).resolves.toEqual({
    mac: "00:16:3e:00:00:01",
    oui: "00163E",
    vendor: "Xensource Inc",
    source: "offline"
  });
  expect(normalizeMac("00-16-3e-00-00-01")).toBe("00163E000001");
  expect(fallback).not.toHaveBeenCalled();
});
