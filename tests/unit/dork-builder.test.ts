/**
 * Dork builder tests prove the analyzer expands local templates without a
 * search-provider side effect. If the builder reached the network, operators
 * could leak target names just by preparing queries.
 */
import { buildDorks } from "../../src/main/analyzers/dork-builder";

it("dork builder creates expected queries locally so operators can copy them deliberately", () => {
  expect(buildDorks("example.com")).toContainEqual({
    label: "Login portals",
    query: "site:example.com intitle:login OR inurl:login"
  });
  expect(buildDorks("example.com")).toContainEqual({
    label: "Directory listings",
    query: "site:example.com intitle:\"index of\""
  });
});
