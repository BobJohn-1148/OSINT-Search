import { normalizeScrapeGraphObservations } from "../../src/main/search/scrapegraph-worker";

it("normalizes ScrapeGraph worker observations into cited search observations", () => {
  const observations = normalizeScrapeGraphObservations(
    { type: "domain", value: "example.com" },
    {
      source_url: "https://example.com",
      observations: [
        {
          entity: "Example Inc",
          type: "organization",
          value: "Example Inc",
          evidence: "Page title",
          confidence: 0.8
        }
      ]
    },
    "scrapegraph-ai"
  );

  expect(observations).toEqual([
    {
      entity: "Example Inc",
      type: "organization",
      value: "Example Inc",
      source: "scrapegraph-ai",
      raw: {
        evidence: "Page title",
        confidence: 0.8,
        sourceUrl: "https://example.com"
      }
    }
  ]);
});

it("falls back to a summary observation when ScrapeGraph returns no structured facts", () => {
  const observations = normalizeScrapeGraphObservations(
    { type: "business", value: "Acme" },
    { source_url: "https://www.google.com/search?q=Acme", summary: "Sparse public page." },
    "scrapegraph-ai"
  );

  expect(observations).toEqual([
    {
      entity: "Acme",
      type: "scrapegraph-summary",
      value: "Sparse public page.",
      source: "scrapegraph-ai",
      raw: { sourceUrl: "https://www.google.com/search?q=Acme" }
    }
  ]);
});
