/**
 * These keyless connectors are the free APIs that make a username and an email
 * seed return something instead of nothing. The tests pin parsing against canned
 * responses (no network) and, just as importantly, that a not-found reply is a
 * clean empty result rather than a thrown source failure — otherwise one missing
 * profile would look like an outage in the search UI.
 */
import { githubUserConnector } from "../../src/main/search/connectors/github-user-connector";
import { gravatarConnector } from "../../src/main/search/connectors/gravatar-connector";
import { ipwhoConnector } from "../../src/main/search/connectors/ipwho-connector";
import { HttpLookupError } from "../../src/main/search/http";
import type { SourceRunContext } from "../../src/main/search/source-connector";

function contextReturning(payload: unknown): SourceRunContext {
  return { fetchJson: () => Promise.resolve(payload) };
}

function contextThrowing(error: Error): SourceRunContext {
  return { fetchJson: () => Promise.reject(error) };
}

it("github connector supports only the username seed", () => {
  expect(githubUserConnector.supports("username")).toBe(true);
  expect(githubUserConnector.supports("email")).toBe(false);
  expect(githubUserConnector.supports("ip")).toBe(false);
});

it("github connector turns a public profile into cited identity facts with a pivot", async () => {
  const observations = await githubUserConnector.run(
    { type: "username", value: "octocat" },
    contextReturning({
      login: "octocat",
      html_url: "https://github.com/octocat",
      name: "The Octocat",
      company: "@github",
      location: "San Francisco",
      blog: "https://github.blog",
      twitter_username: "octocat_tw",
      public_repos: 8,
      followers: 1000,
      created_at: "2011-01-25T18:44:36Z"
    })
  );
  const byType = new Map(observations.map((observation) => [observation.type, observation]));
  expect(byType.get("github-profile")?.raw?.lookupUrl).toBe("https://github.com/octocat");
  expect(byType.get("name")?.value).toBe("The Octocat");
  expect(byType.get("location")?.value).toBe("San Francisco");
  expect(byType.get("linked-account")?.raw?.pivotSeed).toEqual({ type: "username", value: "octocat_tw" });
});

it("github connector returns empty for an unknown user instead of failing the source", async () => {
  const observations = await githubUserConnector.run(
    { type: "username", value: "definitely-not-a-real-user" },
    contextThrowing(new HttpLookupError("HTTP 404 from api.github.com", 404, ""))
  );
  expect(observations).toEqual([]);
});

it("gravatar connector hashes the email and extracts linked accounts as pivots", async () => {
  const observations = await gravatarConnector.run(
    { type: "email", value: "Test@Example.com" },
    contextReturning({
      entry: [
        {
          profileUrl: "https://gravatar.com/test",
          displayName: "Test Person",
          preferredUsername: "testperson",
          currentLocation: "Chicago",
          accounts: [{ shortname: "github", url: "https://github.com/testperson", username: "testperson" }]
        }
      ]
    })
  );
  const types = observations.map((observation) => observation.type);
  expect(types).toContain("gravatar-profile");
  expect(types).toContain("display-name");
  const linked = observations.find((observation) => observation.type === "linked-account");
  expect(linked?.raw?.lookupUrl).toBe("https://github.com/testperson");
  expect(linked?.raw?.pivotSeed).toEqual({ type: "username", value: "testperson" });
});

it("gravatar connector returns empty for an address with no public profile", async () => {
  const observations = await gravatarConnector.run(
    { type: "email", value: "nobody@example.com" },
    contextThrowing(new HttpLookupError("HTTP 404 from www.gravatar.com", 404, ""))
  );
  expect(observations).toEqual([]);
});

it("ipwho connector maps an IP to location, ASN, and ISP", async () => {
  const observations = await ipwhoConnector.run(
    { type: "ip", value: "8.8.8.8" },
    contextReturning({
      success: true,
      city: "Mountain View",
      region: "California",
      country: "United States",
      country_code: "US",
      latitude: 37.4,
      longitude: -122.07,
      postal: "94043",
      calling_code: "1",
      connection: { asn: 15169, org: "Google LLC", isp: "Google LLC", domain: "google.com" },
      timezone: { id: "America/Los_Angeles" }
    })
  );
  const byType = new Map(observations.map((observation) => [observation.type, observation]));
  expect(byType.get("location")?.value).toBe("Mountain View, California, United States");
  expect(byType.get("asn")?.value).toContain("AS15169");
  expect(byType.get("isp")?.value).toBe("Google LLC");
  expect(byType.get("connection-domain")?.value).toBe("google.com");
});

it("ipwho connector returns empty when the API marks the lookup unsuccessful", async () => {
  const observations = await ipwhoConnector.run({ type: "ip", value: "0.0.0.0" }, contextReturning({ success: false, message: "invalid" }));
  expect(observations).toEqual([]);
});
