/**
 * Correlation tests pin strength to independent source overlap because Reacher
 * must never let a connector type confidence by hand. If this logic drifts, the
 * UI could call a weak single-source fact strong.
 */
import { buildSearchTree, correlateObservations, strengthBand } from "../../src/main/search/correlation";
import type { Observation } from "../../src/shared/types/search";

function observation(id: string, entity: string, source: string): Observation {
  return {
    id,
    runId: "run-one",
    entity,
    type: "domain",
    value: entity,
    source,
    confidence: 1
  };
}

it("scoring bands map 1 2 3 and 4 plus sources to single-source likely strong and confirmed", () => {
  expect(strengthBand(1)).toBe("single-source");
  expect(strengthBand(2)).toBe("likely");
  expect(strengthBand(3)).toBe("strong");
  expect(strengthBand(4)).toBe("confirmed");
  expect(strengthBand(7)).toBe("confirmed");
});

it("promotes a 3-source entity to strong because corroboration is computed from distinct sources", () => {
  const entities = correlateObservations([
    observation("one", "example.com", "rdap"),
    observation("two", "example.com", "dns-doh"),
    observation("three", "example.com", "crtsh"),
    observation("four", "other.example", "crtsh")
  ]);

  expect(entities[0]).toMatchObject({
    entity: "example.com",
    strength: 3,
    band: "strong",
    sourceIds: ["crtsh", "dns-doh", "rdap"]
  });
});

it("the tree builds correctly from a fixture set of observations so sources own their leaves", () => {
  const observations = [observation("one", "example.com", "rdap"), observation("two", "mail.example.com", "dns-doh")];
  const entities = correlateObservations(observations);
  const tree = buildSearchTree({
    runId: "run-one",
    seed: { type: "domain", value: "example.com" },
    statuses: [
      { sourceId: "dns-doh", label: "DNS over HTTPS", status: "returned", observationCount: 1 },
      { sourceId: "rdap", label: "RDAP", status: "returned", observationCount: 1 }
    ],
    observations,
    entities
  });

  expect(tree).toMatchObject({
    label: "domain:example.com",
    saveable: true,
    children: [
      { sourceId: "dns-doh", saveable: true, children: [{ label: "mail.example.com", saveable: true }] },
      { sourceId: "rdap", saveable: true, children: [{ label: "example.com", saveable: true }] }
    ]
  });
});
