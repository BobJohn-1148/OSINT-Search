/**
 * The results model decides what counts as corroborated, failed or connected on screen. These tests pin the
 * rules from the evidence-first handoff: exact entity+type+value across source integrations, a failed source is a
 * status (never "nothing found"), and the facts the tree draws come only from what the observations support. If a rule here
 * changed silently, an investigator could be shown a stronger or tidier picture than the data allows.
 */
import { demoObservations, demoRun, demoStatuses } from "../../src/renderer/components/osint-results-demo";
import {
  bandLabel,
  bandForSourceCount,
  buildFacts,
  buildSourceRows,
  computeTotals,
  filterFacts,
  observationsForOutput,
  runDurationLabel
} from "../../src/renderer/components/osint-results-model";
import type { Observation } from "../../src/shared/types/search";

function observation(id: string, source: string, value: string, extra: Partial<Observation> = {}): Observation {
  const families: Record<string, string> = { rdap: "rdap-test", crtsh: "crt-sh-test", "dns-doh": "cloudflare-doh-test" };
  return { id, runId: "run", entity: "example.com", type: "hostname", value, source, confidence: 1, upstreamFamilyId: families[source], ...extra };
}

describe("fact correlation", () => {
  it("cross-references only the same entity, type and value reported by two distinct source integrations", () => {
    const facts = buildFacts([observation("a", "rdap", "mail.example.com"), observation("b", "crtsh", "mail.example.com")]);
    expect(facts).toHaveLength(1);
    expect(facts[0]?.sourceIds).toEqual(["crtsh", "rdap"]);
    expect(facts[0]?.corroborated).toBe(true);
    expect(facts[0]?.band).toBe("likely");
  });

  it("does not count one source repeating itself as a cross-reference", () => {
    const facts = buildFacts([observation("a", "dns-doh", "192.0.2.42"), observation("b", "dns-doh", "192.0.2.42")]);
    expect(facts).toHaveLength(1);
    expect(facts[0]?.observations).toHaveLength(2);
    expect(facts[0]?.sourceIds).toEqual(["dns-doh"]);
    expect(facts[0]?.corroborated).toBe(false);
    expect(facts[0]?.band).toBe("single-source");
  });

  it("keeps directory links visible without counting them as evidence or cross-references", () => {
    const facts = buildFacts([
      observation("a", "osint4all-catalog", "Registry search", { kind: "discovery", type: "osint-tool" }),
      observation("b", "directory-mirror", "Registry search", { kind: "discovery", type: "osint-tool" })
    ]);
    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({ kind: "discovery", corroborated: false, band: "single-source" });
    expect(facts[0] && bandLabel(facts[0].band, facts[0].sourceIds.length, facts[0].kind)).toBe("Discovery resource · not evidence");
  });

  it("keeps near-misses apart: a different entity, type or value is a different fact", () => {
    const facts = buildFacts([
      observation("a", "rdap", "mail.example.com"),
      observation("b", "crtsh", "mail.example.com", { entity: "example.net" }),
      observation("c", "crtsh", "mail.example.com", { type: "domain" }),
      observation("d", "crtsh", "mail.example.org")
    ]);
    expect(facts).toHaveLength(4);
    expect(facts.every((fact) => !fact.corroborated)).toBe(true);
  });

  it("treats the observation type like the correlator does: case and surrounding or repeated space do not split a fact", () => {
    const facts = buildFacts([
      observation("a", "rdap", "mail.example.com", { type: "Host  Name" }),
      observation("b", "crtsh", "mail.example.com", { type: " host name " })
    ]);
    expect(facts).toHaveLength(1);
    expect(facts[0]?.corroborated).toBe(true);
  });

  it("orders hostnames naturally, so host-2 comes before host-10", () => {
    const facts = buildFacts([observation("a", "rdap", "host-10.example.com"), observation("b", "rdap", "host-2.example.com")]);
    expect(facts.map((fact) => fact.value)).toEqual(["host-2.example.com", "host-10.example.com"]);
  });

  it("matches with the same normalisation as the main-process correlator (case and surrounding space only)", () => {
    const facts = buildFacts([observation("a", "rdap", "Mail.Example.COM "), observation("b", "crtsh", "mail.example.com", { entity: " EXAMPLE.com" })]);
    expect(facts).toHaveLength(1);
    expect(facts[0]?.corroborated).toBe(true);
  });

  it("grades by distinct source count: 1 single, 2 likely, 3 strong, 4+ confirmed", () => {
    expect([1, 2, 3, 4, 7].map(bandForSourceCount)).toEqual(["single-source", "likely", "strong", "confirmed", "confirmed"]);
  });

  it("builds facts from observations alone, so a run's own entity table can never promote a fact", () => {
    const run = demoRun({
      observations: [observation("a", "rdap", "mail.example.com")],
      entities: [{ entity: "example.com", type: "hostname", value: "mail.example.com", sourceIds: ["rdap", "crtsh", "nvd", "x"], upstreamFamilyIds: ["a", "b", "c", "d"], strength: 4, band: "confirmed" }]
    });
    const facts = buildFacts(observationsForOutput(run, []));
    expect(facts[0]?.band).toBe("single-source");
  });

  it("does not borrow the seed type for tree-only results, because the tree does not record an observation type", () => {
    const run = demoRun({
      observations: [],
      tree: {
        id: "root",
        label: "domain:example.com",
        kind: "root",
        saveable: true,
        children: [{ id: "n1", label: "example.com", kind: "observation", sourceId: "rdap", observationId: "obs-1", entity: "example.com", saveable: true, children: [] }]
      }
    });
    const only = observationsForOutput(run, []).at(0);
    expect(only?.type).toBe("observation");
    expect(only?.raw).toEqual({ treeNodeId: "n1" });
  });
});

describe("source rows", () => {
  it("shows a failed source as a status with its error, not as evidence of absence", () => {
    const rows = buildSourceRows(demoStatuses, demoObservations);
    const failed = rows.find((row) => row.sourceId === "website-contact");
    expect(failed?.state).toBe("failed");
    expect(failed?.stateLabel).toBe("Timed out");
    expect(failed?.count).toBeNull();
    expect(failed?.detail).toContain("Request timed out after 15 seconds");
    expect(failed?.detail).toMatch(/does not show that the seed is absent or safe/);
  });

  it("reads a cancelled source as cancelled, not as an error, while still never calling it evidence of absence", () => {
    const row = buildSourceRows([{ sourceId: "x", label: "X", status: "failed", failureKind: "cancelled", observationCount: 0, error: "Cancelled" }], []).at(0);
    expect(row?.stateLabel).toBe("Cancelled");
    expect(row?.summary).toBe("Cancelled before it finished");
    expect(row?.detail).toMatch(/Evidence returned so far is kept/);
    expect(row?.detail).toMatch(/does not show that the seed is absent or safe/);
  });

  it("counts a cancelled source as cancelled, not failed, in the totals", () => {
    const rows = buildSourceRows(
      [
        { sourceId: "c", label: "C", status: "failed", failureKind: "cancelled", observationCount: 0, error: "Cancelled" },
        { sourceId: "t", label: "T", status: "failed", observationCount: 0, error: "Request timed out" }
      ],
      []
    );
    const totals = computeTotals([], [], rows);
    expect(totals.cancelledSources).toBe(1);
    expect(totals.failedSources).toBe(1);
  });

  it("labels a non-timeout failure plainly as Failed", () => {
    const row = buildSourceRows([{ sourceId: "x", label: "X", status: "failed", observationCount: 0, error: "HTTP 503" }], []).at(0);
    expect(row?.stateLabel).toBe("Failed");
  });

  it("distinguishes policy-skipped sources from errors and excludes them from reported counts", () => {
    const row = buildSourceRows([{ sourceId: "cloud", label: "Cloud provider", status: "skipped", observationCount: 0, error: "Not run by policy" }], []).at(0);
    expect(row).toMatchObject({ state: "skipped", stateLabel: "Skipped", summary: "Not run by policy" });
    const totals = computeTotals([], [], row ? [row] : []);
    expect(totals).toMatchObject({ failedSources: 0, skippedSources: 1, returnedSources: 0, totalSources: 1 });
  });

  it("describes a source that returned nothing as a result for that source only", () => {
    const rows = buildSourceRows(demoStatuses, demoObservations);
    const nvd = rows.find((row) => row.sourceId === "nvd");
    expect(nvd?.state).toBe("returned");
    expect(nvd?.count).toBe(0);
    expect(nvd?.detail).toMatch(/not proof that nothing exists/);
  });

  it("labels truncated results Partial and exposes their source policy", () => {
    const policy = {
      accessMode: "public-api" as const,
      jurisdiction: "US federal",
      documentedQuota: null,
      localRequestBudget: "2 requests/second; max 3 pages",
      termsUrl: "https://api.usaspending.gov/docs/endpoints",
      coverage: "Federal recipients only; not an ownership source.",
      freshness: "Agency reporting lag varies.",
      enabled: true
    };
    const row = buildSourceRows([{
      sourceId: "usaspending",
      label: "USAspending",
      status: "returned",
      observationCount: 0,
      warning: "Partial result: pagination capped.",
      policy
    }], []).at(0);
    expect(row).toMatchObject({ stateLabel: "Partial", summary: "Partial result: pagination capped.", policy });
    expect(row?.detail).toContain("incomplete source result");
  });

  it("lists a source that streamed observations before its status as reporting, never as failed", () => {
    const rows = buildSourceRows([], [observation("a", "late-source", "x.example.com")]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.state).toBe("observed");
    expect(rows[0]?.stateLabel).toBe("Reporting");
  });

  it("counts a source's observations from the observations themselves, not from the status it reported", () => {
    const rows = buildSourceRows(
      [{ sourceId: "rdap", label: "RDAP", status: "returned", observationCount: 99 }],
      [observation("a", "rdap", "x.example.com"), observation("b", "rdap", "y.example.com")]
    );
    expect(rows.at(0)?.count).toBe(2);
  });

  it("derives totals from the data, with failed sources counted separately and evidence kept", () => {
    const facts = buildFacts(demoObservations);
    const rows = buildSourceRows(demoStatuses, demoObservations);
    const totals = computeTotals(demoObservations, facts, rows);
    expect(totals.observations).toBe(demoObservations.length);
    expect(totals.uniqueFacts).toBe(facts.length);
    expect(totals.corroboratedFacts).toBe(facts.filter((fact) => fact.sourceIds.length > 1).length);
    expect(totals.failedSources).toBe(1);
    expect(totals.sourcesWithEvidence).toBe(3);
    expect(totals.totalSources).toBe(5);
  });
});

describe("evidence filtering", () => {
  const facts = buildFacts(demoObservations);
  const labels = new Map(demoStatuses.map((status) => [status.sourceId, status.label]));

  it("splits cross-referenced from single-source facts", () => {
    const cross = filterFacts(facts, { filter: "corroborated", text: "", sourceId: null }, labels);
    const single = filterFacts(facts, { filter: "single", text: "", sourceId: null }, labels);
    expect(cross.every((fact) => fact.corroborated)).toBe(true);
    expect(single.every((fact) => !fact.corroborated)).toBe(true);
    expect(cross.length + single.length).toBe(facts.length);
  });

  it("matches text against value, entity, type, source id and source label", () => {
    const find = (text: string) => filterFacts(facts, { filter: "all", text, sourceId: null }, labels).length;
    expect(find("192.0.2.42")).toBe(1);
    expect(find("registrar")).toBe(1);
    expect(find("nameserver")).toBe(2);
    expect(find("ns2.example.net")).toBe(1);
    // the entity field is searchable on its own: only these two facts have the entity "mail.example.com"
    expect(find("mail.example.com")).toBeGreaterThanOrEqual(2);
    expect(find("DNS over HTTPS")).toBeGreaterThan(0);
    expect(find("crtsh")).toBeGreaterThan(0);
    expect(find("no such text anywhere")).toBe(0);
  });

  it("filters by an exact source id", () => {
    const rdap = filterFacts(facts, { filter: "all", text: "", sourceId: "rdap" }, labels);
    expect(rdap.length).toBeGreaterThan(0);
    expect(rdap.every((fact) => fact.sourceIds.includes("rdap"))).toBe(true);
  });
});

describe("run timing", () => {
  it("formats the duration as mm:ss and refuses to invent one", () => {
    expect(runDurationLabel("2026-09-30T18:00:00.000Z", "2026-09-30T18:00:18.000Z")).toBe("00:18");
    expect(runDurationLabel("2026-09-30T18:00:00.000Z", "2026-09-30T18:02:05.000Z")).toBe("02:05");
    expect(runDurationLabel("2026-09-30T18:00:00.000Z", null)).toBeNull();
    expect(runDurationLabel("not a date", "2026-09-30T18:00:18.000Z")).toBeNull();
    expect(runDurationLabel("2026-09-30T18:00:18.000Z", "2026-09-30T18:00:00.000Z")).toBeNull();
  });
});
