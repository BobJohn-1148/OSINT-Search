/**
 * ScrapeGraph is the only source that hands a secret to a child process, so
 * these tests pin the two things that would be silent failures in production:
 * the key comes from the vault-resolved run context rather than ambient
 * environment, and worker stderr reaching the source list is scrubbed of
 * anything key-shaped first. A leaked key in a failure message would be visible
 * on the results board and in the audit trail.
 */
import { scrapeGraphConnector } from "../../src/main/search/connectors/scrapegraph-connector";
import { normalizeScrapeGraphObservations, sanitizeWorkerError } from "../../src/main/search/scrapegraph-worker";
import { fetchJson } from "../../src/main/search/http";

const seed = { type: "domain", value: "example.com" } as const;

it("declares the openai vault key so the orchestrator resolves it through the audited gate", () => {
  expect(scrapeGraphConnector.keyRequired).toBe(true);
  expect(scrapeGraphConnector.keySource).toBe("openai");
  expect(scrapeGraphConnector.tier).toBe("passive");
  expect(scrapeGraphConnector.supports("domain")).toBe(true);
  expect(scrapeGraphConnector.supports("business")).toBe(true);
  expect(scrapeGraphConnector.supports("ip")).toBe(false);
});

it("stays quiet with no stored key instead of failing the source, matching every other keyed connector", async () => {
  const observations = await scrapeGraphConnector.run(seed, { fetchJson, apiKey: null });

  expect(observations).toEqual([]);
});

it("normalizes worker observations into cited facts and carries the page URL through as the lookup link", () => {
  const observations = normalizeScrapeGraphObservations(
    seed,
    {
      source_url: "https://example.com/contact",
      observations: [
        { entity: "example.com", type: "email", value: "hello@example.com", evidence: "contact page", confidence: 0.9 },
        { type: "phone", value: "+1 555 0100", source_url: "https://example.com/about" },
        { type: "empty", value: "   " }
      ]
    },
    "scrapegraph-ai"
  );

  expect(observations).toEqual([
    {
      entity: "example.com",
      type: "email",
      value: "hello@example.com",
      source: "scrapegraph-ai",
      raw: { evidence: "contact page", confidence: 0.9, sourceUrl: "https://example.com/contact", lookupUrl: "https://example.com/contact" }
    },
    {
      entity: "example.com",
      type: "phone",
      value: "+1 555 0100",
      source: "scrapegraph-ai",
      raw: { evidence: null, confidence: undefined, sourceUrl: "https://example.com/about", lookupUrl: "https://example.com/about" }
    }
  ]);
});

it("falls back to the summary when the page yielded no structured facts, so a run is never silently empty", () => {
  const observations = normalizeScrapeGraphObservations(
    seed,
    { source_url: "https://example.com", observations: [], summary: "A holding page with no contact details." },
    "scrapegraph-ai"
  );

  expect(observations).toHaveLength(1);
  expect(observations[0]).toMatchObject({ type: "scrapegraph-summary", value: "A holding page with no contact details." });
});

it("drops duplicate facts so one repeated address does not look like corroboration", () => {
  const observations = normalizeScrapeGraphObservations(
    seed,
    {
      observations: [
        { entity: "example.com", type: "email", value: "hello@example.com" },
        { entity: "example.com", type: "email", value: "hello@example.com" }
      ]
    },
    "scrapegraph-ai"
  );

  expect(observations).toHaveLength(1);
});

it("redacts an API key that appears in worker stderr before it reaches the results board", () => {
  const message = sanitizeWorkerError("Traceback...\nAuthenticationError: bad key sk-proj-abc123DEF456\n");

  expect(message).toContain("sk-[redacted]");
  expect(message).not.toContain("abc123DEF456");
});

it("turns an exhausted OpenAI quota into an instruction rather than a raw provider error", () => {
  const message = sanitizeWorkerError("openai.RateLimitError: You exceeded your current quota, insufficient_quota");

  expect(message).toMatch(/quota is exhausted/i);
  expect(message).toMatch(/API credits/i);
});
