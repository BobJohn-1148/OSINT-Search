/**
 * These tests exist because DNS over HTTPS failed on every domain search for a
 * long time without anyone noticing: fetchJson force-set `accept:
 * application/json`, Cloudflare answered 400, and the orchestrator's per-source
 * failure isolation turned a total evidence loss into one quiet red line in the
 * source list. Both halves are pinned here — the connector asking for the media
 * type Cloudflare actually serves, and fetchJson no longer overwriting a caller
 * that asked for something specific.
 */
import { dnsDohConnector } from "../../src/main/search/connectors/dns-doh-connector";
import { fetchJson } from "../../src/main/search/http";

const seed = { type: "domain", value: "example.com" } as const;

function dnsAnswer(data: string) {
  return { Status: 0, Answer: [{ name: "example.com", type: 1, TTL: 300, data }] };
}

it("asks Cloudflare for application/dns-json, the only media type its JSON API answers", async () => {
  const accepts: (string | null)[] = [];
  await dnsDohConnector.run(seed, {
    fetchJson: (_url, init) => {
      accepts.push(new Headers(init?.headers).get("accept"));
      return Promise.resolve(dnsAnswer("93.184.216.34"));
    }
  });

  expect(accepts.length).toBeGreaterThan(0);
  expect(new Set(accepts)).toEqual(new Set(["application/dns-json"]));
});

it("queries every record type by name so a domain profile carries more than its A record", async () => {
  const requested: string[] = [];
  await dnsDohConnector.run(seed, {
    fetchJson: (url) => {
      const parsed = new URL(url);
      expect(parsed.searchParams.get("name")).toBe("example.com");
      requested.push(parsed.searchParams.get("type") ?? "");
      return Promise.resolve(dnsAnswer("93.184.216.34"));
    }
  });

  expect(requested.sort()).toEqual(["A", "AAAA", "MX", "NS", "TXT"]);
});

it("turns answers into per-record observations and strips the trailing root dot", async () => {
  const observations = await dnsDohConnector.run(seed, {
    fetchJson: (url) =>
      Promise.resolve(new URL(url).searchParams.get("type") === "NS" ? dnsAnswer("a.iana-servers.net.") : { Status: 0 })
  });

  expect(observations).toEqual([
    {
      entity: "example.com",
      type: "dns-ns",
      value: "a.iana-servers.net",
      source: "dns-doh",
      raw: { recordType: "NS", ttl: 300 }
    }
  ]);
});

it("keeps the other four record types' observations when exactly one record type's lookup rejects", async () => {
  const observations = await dnsDohConnector.run(seed, {
    fetchJson: (url) => {
      const recordType = new URL(url).searchParams.get("type");
      if (recordType === "TXT") {
        return Promise.reject(new Error("Cloudflare 502"));
      }
      return Promise.resolve(recordType === "A" ? dnsAnswer("93.184.216.34") : { Status: 0 });
    }
  });

  expect(observations).toEqual([
    { entity: "example.com", type: "dns-a", value: "93.184.216.34", source: "dns-doh", raw: { recordType: "A", ttl: 300 } }
  ]);
});

it("still throws when every record type's lookup rejects, so the source is reported failed instead of silently empty", async () => {
  await expect(
    dnsDohConnector.run(seed, {
      fetchJson: () => Promise.reject(new Error("Cloudflare unreachable"))
    })
  ).rejects.toThrow("Cloudflare unreachable");
});

it("still defaults to application/json for a caller that does not ask for anything, so other connectors are untouched", async () => {
  let sentAccept: string | null = null;
  const originalFetch = global.fetch;
  global.fetch = ((url: string, init?: RequestInit) => {
    sentAccept = new Headers(init?.headers).get("accept");
    return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
  }) as unknown as typeof fetch;

  try {
    await fetchJson("https://example.com/api");
  } finally {
    global.fetch = originalFetch;
  }

  expect(sentAccept).toBe("application/json");
});
