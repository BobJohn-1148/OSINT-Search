/**
 * Social analyzer tests prove breadth without pretending candidates are hits.
 * If the service returned verified-looking profiles from templates, later case
 * evidence could inherit uncited claims.
 */
import { SocialAnalyzerService } from "../../src/main/social/social-analyzer-service";

it("generates candidate social profiles across more than three hundred networks without marking them verified", () => {
  const result = new SocialAnalyzerService().analyze({ username: "alice", limit: 320 });

  expect(result.totalNetworks).toBeGreaterThanOrEqual(300);
  expect(result.candidates).toHaveLength(320);
  expect(result.candidates[0]).toMatchObject({ status: "candidate" });
  expect(result.candidates.every((candidate) => candidate.url.includes("alice"))).toBe(true);
  expect(result.recommendedTools).toEqual(expect.arrayContaining(["maigret-social", "whatsmyname"]));
});
