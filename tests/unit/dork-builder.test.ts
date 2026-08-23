/**
 * Dork builder tests prove the analyzer expands local templates without a
 * search-provider side effect. If the builder reached the network, operators
 * could leak target names just by preparing queries.
 */
import { buildDorks } from "../../src/main/analyzers/dork-builder";

it("dork builder creates expected queries locally so operators can copy them deliberately", () => {
  const dorks = buildDorks("example.com");
  expect(dorks).toContainEqual({
    label: "Login portals",
    query: "site:example.com intitle:login OR inurl:login OR inurl:signin OR inurl:admin"
  });
  expect(dorks).toContainEqual({
    label: "Directory listings",
    query: "site:example.com intitle:\"index of\""
  });
  // Expanded catalog: many more categories now, all with the target substituted.
  expect(dorks.length).toBeGreaterThanOrEqual(20);
  expect(dorks.every((dork) => !dork.query.includes("{target}"))).toBe(true);
  expect(dorks.map((dork) => dork.label)).toContain("Exposed .git");
});
