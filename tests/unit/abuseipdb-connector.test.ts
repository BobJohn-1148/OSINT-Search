/**
 * AbuseIPDB is the first key-based search source, so its contract is pinned: with
 * a key it parses reputation into cited observations, and with no key it stays
 * completely silent — no request, no throw — so an unconfigured source never
 * looks like a failure or leaks a call the user did not enable.
 */
import { abuseIpDbConnector } from "../../src/main/search/connectors/abuseipdb-connector";
import type { SourceRunContext } from "../../src/main/search/source-connector";

it("declares its vault key source so the orchestrator knows which secret to resolve", () => {
  expect(abuseIpDbConnector.keyRequired).toBe(true);
  expect(abuseIpDbConnector.keySource).toBe("abuseipdb");
  expect(abuseIpDbConnector.supports("ip")).toBe(true);
  expect(abuseIpDbConnector.supports("domain")).toBe(false);
});

it("parses reputation into observations when a key is present", async () => {
  let requestedUrl = "";
  let sentHeaders: HeadersInit | undefined;
  const context: SourceRunContext = {
    apiKey: "abuse-test-key",
    fetchJson: (url, init) => {
      requestedUrl = url;
      sentHeaders = init?.headers;
      return Promise.resolve({
        data: {
          ipAddress: "118.25.6.39",
          abuseConfidenceScore: 100,
          totalReports: 42,
          countryCode: "CN",
          isp: "Tencent Cloud",
          domain: "tencent.com",
          usageType: "Data Center/Web Hosting/Transit",
          lastReportedAt: "2026-08-14T00:00:00+00:00",
          isTor: false
        }
      });
    }
  };

  const observations = await abuseIpDbConnector.run({ type: "ip", value: "118.25.6.39" }, context);
  const byType = new Map(observations.map((observation) => [observation.type, observation]));

  expect(requestedUrl).toContain("api.abuseipdb.com/api/v2/check");
  expect(requestedUrl).toContain("ipAddress=118.25.6.39");
  expect((sentHeaders as Record<string, string>).Key).toBe("abuse-test-key");
  expect(byType.get("abuse-score")?.value).toBe("Abuse confidence 100%");
  expect(byType.get("abuse-score")?.raw?.lookupUrl).toContain("abuseipdb.com/check/118.25.6.39");
  expect(byType.get("total-reports")?.value).toBe("42 reports (90d)");
  expect(byType.get("isp")?.value).toBe("Tencent Cloud");
});

it("returns nothing and makes no request when no key is stored", async () => {
  let called = false;
  const context: SourceRunContext = {
    apiKey: null,
    fetchJson: () => {
      called = true;
      return Promise.resolve({});
    }
  };

  const observations = await abuseIpDbConnector.run({ type: "ip", value: "8.8.8.8" }, context);
  expect(observations).toEqual([]);
  expect(called).toBe(false);
});
