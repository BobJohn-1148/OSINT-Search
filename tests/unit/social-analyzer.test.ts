/**
 * Social analyzer tests prove breadth without pretending candidates are hits.
 * If the service returned verified-looking profiles from templates, later case
 * evidence could inherit uncited claims. The verify() tests use real entries
 * from the generated catalog (about.me, 247CTF) rather than synthetic rules,
 * so a fixture drifting from the real WhatsMyName data would actually be
 * caught here instead of only passing against an idealized shape.
 */
import Database from "better-sqlite3";
import { runMigrations } from "../../src/db/migrations/runner";
import { AuditRepository } from "../../src/db/repositories/audit-repository";
import { SocialAnalyzerService, type SocialProbe } from "../../src/main/social/social-analyzer-service";
import { generatedSocialNetworks } from "../../src/main/social/social-network-catalog.generated";

it("generates candidate social profiles across more than three hundred networks without marking them verified", () => {
  const result = new SocialAnalyzerService().analyze({ username: "alice", limit: 320 });

  expect(result.totalNetworks).toBeGreaterThanOrEqual(300);
  expect(result.candidates).toHaveLength(320);
  expect(result.candidates[0]).toMatchObject({ status: "candidate" });
  expect(result.candidates.every((candidate) => candidate.url.includes("alice"))).toBe(true);
  expect(result.recommendedTools).toEqual(expect.arrayContaining(["maigret-social", "whatsmyname"]));
});

it("marks a candidate verified only when the response matches that network's real exists rule", async () => {
  const aboutMe = generatedSocialNetworks.find((network) => network.name === "about.me");
  if (!aboutMe) {
    throw new Error("Fixture assumption broken: 'about.me' is no longer in the generated catalog");
  }
  const aboutMeUrl = `https://about.me/jdoe`;
  const probe: SocialProbe = (url) => {
    if (url === aboutMeUrl) {
      return Promise.resolve({ status: aboutMe.existsStatus, body: `<html><title>jdoe${aboutMe.existsString}</title></html>` });
    }
    return Promise.resolve({ status: 500, body: "" });
  };
  const service = new SocialAnalyzerService(undefined, probe);

  const result = await service.verify({ username: "jdoe", limit: generatedSocialNetworks.length });
  const candidate = result.candidates.find((entry) => entry.network === "about.me");

  expect(candidate?.status).toBe("verified");
});

it("marks a candidate absent when the response matches the network's real missing rule instead", async () => {
  const aboutMe = generatedSocialNetworks.find((network) => network.name === "about.me");
  if (!aboutMe) {
    throw new Error("Fixture assumption broken: 'about.me' is no longer in the generated catalog");
  }
  const probe: SocialProbe = () => Promise.resolve({ status: aboutMe.missingStatus, body: `<html>${aboutMe.missingString}</html>` });
  const service = new SocialAnalyzerService(undefined, probe);

  const result = await service.verify({ username: "jdoe", limit: generatedSocialNetworks.length });
  const candidate = result.candidates.find((entry) => entry.network === "about.me");

  expect(candidate?.status).toBe("absent");
});

it("marks a candidate unknown when the response matches neither rule, rather than guessing", async () => {
  const probe: SocialProbe = () => Promise.resolve({ status: 500, body: "internal server error" });
  const service = new SocialAnalyzerService(undefined, probe);

  const result = await service.verify({ username: "jdoe", limit: generatedSocialNetworks.length });
  const candidate = result.candidates.find((entry) => entry.network === "about.me");

  expect(candidate?.status).toBe("unknown");
});

it("marks a candidate unknown, not absent, when the probe fails outright (timeout or network error)", async () => {
  const probe: SocialProbe = () => Promise.resolve(null);
  const service = new SocialAnalyzerService(undefined, probe);

  const result = await service.verify({ username: "jdoe", limit: generatedSocialNetworks.length });

  expect(result.candidates.every((candidate) => candidate.status === "unknown")).toBe(true);
  expect(result.checkedCount).toBeGreaterThan(0);
});

it("skips protected networks without ever calling the probe, since a direct fetch can't reliably pass Cloudflare/captcha", async () => {
  const protectedNetwork = generatedSocialNetworks.find((network) => network.name === "247CTF");
  if (!protectedNetwork?.protected) {
    throw new Error("Fixture assumption broken: '247CTF' is no longer marked protected in the generated catalog");
  }
  const calledUrls: string[] = [];
  const probe: SocialProbe = (url) => {
    calledUrls.push(url);
    return Promise.resolve({ status: 200, body: "" });
  };
  const service = new SocialAnalyzerService(undefined, probe);

  const result = await service.verify({ username: "jdoe", limit: generatedSocialNetworks.length });
  const candidate = result.candidates.find((entry) => entry.network === "247CTF");

  expect(candidate?.status).toBe("unknown");
  expect(calledUrls.some((url) => url.includes("247ctf.com"))).toBe(false);
  expect(result.skippedCount).toBeGreaterThan(0);
});

it("never runs more than the configured number of probes at once, so a verify pass throttles instead of flooding the network", async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const probe: SocialProbe = async () => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 5));
    inFlight -= 1;
    return { status: 200, body: "" };
  };
  const concurrency = 4;
  const service = new SocialAnalyzerService(undefined, probe, concurrency);

  await service.verify({ username: "jdoe", limit: 40 });

  expect(maxInFlight).toBeLessThanOrEqual(concurrency);
  expect(maxInFlight).toBeGreaterThan(1);
});

it("records exactly one audit event per verify pass, summarizing the sweep rather than one row per site", async () => {
  const db = new Database(":memory:");
  runMigrations(db);
  const auditRepository = new AuditRepository(db);
  const probe: SocialProbe = () => Promise.resolve({ status: 200, body: "" });
  const service = new SocialAnalyzerService(auditRepository, probe);

  await service.verify({ username: "jdoe", limit: 20 });

  const events = auditRepository.list(10);
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ action: "social.verify", sensitivity: "medium" });
  const detail = events[0]?.detail as { readonly username: string; readonly checkedCount: number };
  expect(detail.username).toBe("jdoe");
  expect(typeof detail.checkedCount).toBe("number");
});
