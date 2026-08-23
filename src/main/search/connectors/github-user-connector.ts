/**
 * The GitHub public user API is a keyless, zero-signup source, so it is the
 * cheapest way to give a username seed real evidence instead of nothing — before
 * this, no search connector supported the username seed at all. It reads only
 * public profile fields GitHub already serves anonymously, and a missing user is
 * a clean empty result, not a source failure.
 */
import type { ObservationInput, SearchSeed, SeedType } from "../../../shared/types/search.js";
import { asRecord, asString, HttpLookupError } from "../http.js";
import type { SourceConnector, SourceRunContext } from "../source-connector.js";

const sourceId = "github-user";

export const githubUserConnector: SourceConnector = {
  id: sourceId,
  label: "GitHub profile",
  category: "identity",
  tier: "passive",
  keyRequired: false,
  supports(seedType: SeedType): boolean {
    return seedType === "username";
  },
  async run(seed: SearchSeed, context: SourceRunContext): Promise<readonly ObservationInput[]> {
    const handle = seed.value.trim().replace(/^@/, "");
    if (handle.length === 0) {
      return [];
    }
    let response: Record<string, unknown>;
    try {
      response = asRecord(
        await context.fetchJson(`https://api.github.com/users/${encodeURIComponent(handle)}`, { signal: context.signal })
      );
    } catch (error) {
      // A 404 means "no such public user" — real information, not a failure, so
      // it returns empty rather than propagating and marking the source failed.
      if (error instanceof HttpLookupError && error.message.includes("404")) {
        return [];
      }
      throw error;
    }

    const login = asString(response.login) ?? handle;
    const entity = `username:${login.toLowerCase()}`;
    const profileUrl = asString(response.html_url);
    const twitter = asString(response.twitter_username);

    const observations: (ObservationInput | null)[] = [
      profileUrl ? { entity, type: "github-profile", value: `GitHub @${login}`, source: sourceId, raw: { ...response, lookupUrl: profileUrl } } : null,
      fact(entity, "name", asString(response.name), response),
      fact(entity, "company", asString(response.company), response),
      fact(entity, "location", asString(response.location), response),
      fact(entity, "bio", asString(response.bio), response),
      fact(entity, "website", asString(response.blog), response),
      twitter ? { entity, type: "linked-account", value: `Twitter/X @${twitter}`, source: sourceId, raw: { ...response, lookupUrl: `https://x.com/${twitter}`, pivotSeed: { type: "username", value: twitter } } } : null,
      fact(entity, "public-repos", numberText(response.public_repos, "public repositories"), response),
      fact(entity, "followers", numberText(response.followers, "followers"), response),
      fact(entity, "account-created", asString(response.created_at), response)
    ];

    return observations.filter((entry): entry is ObservationInput => entry !== null);
  }
};

function fact(entity: string, type: string, value: string | null, raw: Record<string, unknown>): ObservationInput | null {
  return value === null ? null : { entity, type, value, source: sourceId, raw };
}

function numberText(value: unknown, label: string): string | null {
  return typeof value === "number" && Number.isFinite(value) ? `${value} ${label}` : null;
}
