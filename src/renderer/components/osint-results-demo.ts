/**
 * Demo fixtures exist so the results surface can be reviewed (and screenshotted) without contacting any
 * provider or touching real personal data. They use only reserved example domains and TEST-NET addresses
 * (RFC 2606 / RFC 5737), and the preview labels them as demo data so a fixture can never pass for a lookup.
 * Nothing in the app imports this file; only the preview entry and the tests do.
 */
import type { Observation, SearchRunResult, SourceStatus } from "../../shared/types/search";

export const demoLabel = "Demo data · reserved example domains and TEST-NET addresses · no lookup was made";

const RUN_ID = "demo-run";

function obs(id: string, source: string, type: string, value: string, entity = "example.com", raw: Record<string, unknown> = {}): Observation {
  const upstreamFamilyId = source === "dns-doh" ? "cloudflare-doh" : source === "crtsh" ? "crt-sh" : undefined;
  return { id, runId: RUN_ID, entity, type, value, source, confidence: 1, upstreamFamilyId, raw };
}

export const demoStatuses: SourceStatus[] = [
  { sourceId: "dns-doh", label: "DNS over HTTPS", status: "returned", observationCount: 5 },
  { sourceId: "crtsh", label: "crt.sh", status: "returned", observationCount: 4 },
  { sourceId: "rdap", label: "RDAP", status: "returned", observationCount: 4 },
  { sourceId: "nvd", label: "NVD", status: "returned", observationCount: 0 },
  { sourceId: "website-contact", label: "Website contacts", status: "failed", observationCount: 0, error: "Request timed out after 15 seconds" }
];

export const demoObservations: Observation[] = [
  obs("dns-01", "dns-doh", "domain", "example.com", "example.com", { sourceUrl: "https://dns.example.test/resolve?name=example.com", record: "A" }),
  obs("dns-02", "dns-doh", "ip", "192.0.2.42", "example.com", { sourceUrl: "https://dns.example.test/resolve?name=example.com", ttl: 300 }),
  obs("dns-03", "dns-doh", "ip", "192.0.2.42", "example.com", { sourceUrl: "https://dns.example.test/resolve?name=example.com", ttl: 300 }),
  obs("dns-04", "dns-doh", "hostname", "mail.example.com", "example.com", { record: "MX", priority: 10 }),
  obs("dns-05", "dns-doh", "ip", "198.51.100.7", "mail.example.com", { sourceUrl: "https://dns.example.test/resolve?name=mail.example.com" }),
  obs("ct-01", "crtsh", "domain", "example.com", "example.com", { sourceUrl: "https://certs.example.test/?q=example.com" }),
  obs("ct-02", "crtsh", "hostname", "mail.example.com", "example.com", { sourceUrl: "https://certs.example.test/?q=example.com", issuer: "Example CA" }),
  obs("ct-03", "crtsh", "hostname", "www.example.com", "example.com", { sourceUrl: "https://certs.example.test/?q=example.com" }),
  obs("ct-04", "crtsh", "hostname", "api.example.com", "example.com", { sourceUrl: "https://certs.example.test/?q=example.com" }),
  obs("rd-01", "rdap", "domain", "example.com", "example.com", { sourceUrl: "https://rdap.example.test/domain/example.com" }),
  obs("rd-02", "rdap", "registrar", "Example Registrar", "example.com", { sourceUrl: "https://rdap.example.test/domain/example.com" }),
  obs("rd-03", "rdap", "nameserver", "ns1.example.net", "example.com", { sourceUrl: "https://rdap.example.test/domain/example.com" }),
  obs("rd-04", "rdap", "nameserver", "ns2.example.net", "example.com", { sourceUrl: "https://rdap.example.test/domain/example.com" })
];

export function demoRun(overrides: Partial<SearchRunResult> = {}): SearchRunResult {
  return {
    runId: RUN_ID,
    seed: { type: "domain", value: "example.com" },
    startedTs: "2026-09-30T18:00:00.000Z",
    completedTs: "2026-09-30T18:00:18.000Z",
    statuses: demoStatuses,
    observations: demoObservations,
    entities: [],
    tree: { id: "root", label: "domain:example.com", kind: "root", saveable: true, children: [] },
    ...overrides
  };
}

/** A larger run for checking list paging, graph limits and layout under load. */
export function demoManyObservations(count = 240): { statuses: SourceStatus[]; observations: Observation[] } {
  const sources = ["dns-doh", "crtsh", "rdap", "passive-dns"];
  const observations: Observation[] = [];
  for (let index = 0; index < count; index += 1) {
    const host = `host-${Math.floor(index / 2)}.example.com`;
    const source = sources[index % sources.length] ?? "dns-doh";
    observations.push(obs(`many-${index}`, source, "hostname", host, "example.com", { sourceUrl: `https://${source}.example.test/${index}` }));
  }
  return {
    statuses: sources.map((sourceId) => ({ sourceId, label: sourceId, status: "returned" as const, observationCount: count / sources.length })),
    observations
  };
}

export const demoAssessment = {
  agentName: "OSINT agent",
  title: "DNS and certificate records agree on the seed",
  summary:
    "The sample shows two declared upstream families returning the same domain; the RDAP aggregator has unknown lineage and adds no corroboration vote. This does not prove the listed hosts share an operator or are currently active.",
  sources: ["dns-01", "ct-01", "rd-01"],
  confidence: 1
} as const;
