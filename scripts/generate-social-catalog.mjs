#!/usr/bin/env node
/**
 * Regenerates the social network catalog from a local copy of WhatsMyName's
 * wmn-data.json. Kept as a script (not run at build time) because the upstream
 * dataset changes on its own schedule -- the app ships a point-in-time
 * snapshot, re-generated deliberately, not fetched live on every run.
 *
 * Usage: node scripts/generate-social-catalog.mjs [path/to/wmn-data.json]
 * Download the source file yourself first (see the README this prints on a
 * missing-file error) -- this script never reaches the network.
 */
import fs from "node:fs";
import path from "node:path";

const SOURCE_PATH = process.argv[2] ?? ".cache/wmn-data.json";
const OUTPUT_PATH = path.join("src", "main", "social", "social-network-catalog.generated.ts");
const MIN_SITE_COUNT = 300;

if (!fs.existsSync(SOURCE_PATH)) {
  console.error(
    `Missing ${SOURCE_PATH}. Download it first:\n` +
      `  curl -sL https://raw.githubusercontent.com/WebBreacher/WhatsMyName/main/wmn-data.json -o ${SOURCE_PATH}`
  );
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(SOURCE_PATH, "utf8"));
if (!Array.isArray(data.sites) || data.sites.length < MIN_SITE_COUNT) {
  console.error(`Expected at least ${MIN_SITE_COUNT} sites in ${SOURCE_PATH}, found ${data.sites?.length ?? 0}.`);
  process.exit(1);
}

const entries = data.sites
  // A handful of WhatsMyName entries check the username through a POST body
  // against a static API endpoint instead of a per-account URL -- uri_check
  // has no {account} placeholder at all. Those can't become a clickable
  // candidate link (the URL alone doesn't identify an account) or a GET-based
  // verification probe, so they're excluded rather than generating a dead or
  // misleading link.
  .filter((site) => typeof site.name === "string" && typeof site.uri_check === "string" && site.uri_check.includes("{account}"))
  .map((site) => ({
    name: site.name,
    uri: site.uri_check,
    existsStatus: typeof site.e_code === "number" ? site.e_code : 200,
    existsString: typeof site.e_string === "string" ? site.e_string : "",
    missingStatus: typeof site.m_code === "number" ? site.m_code : 404,
    missingString: typeof site.m_string === "string" ? site.m_string : "",
    protected: Array.isArray(site.protection) && site.protection.length > 0
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const header = `/**
 * Generated from WebBreacher WhatsMyName wmn-data.json because social
 * analysis needs broad offline coverage without fabricating matches. If this
 * catalog shrinks below ${MIN_SITE_COUNT} entries, the Social analyzer stops meeting its
 * public-network coverage promise.
 *
 * existsStatus/existsString and missingStatus/missingString are the real
 * per-site detection rule WhatsMyName uses -- what the HTTP response looks
 * like when the account exists vs. when it does not. A bare "HTTP 200" check
 * would be wrong for most sites, since many return 200 for both a real
 * profile and a "not found" page; matching the response against the rule
 * that actually distinguishes the two is what makes real verification
 * possible. "protected" sites (Cloudflare, captcha, etc.) are excluded from
 * verification rather than guessed at, since a direct fetch cannot reliably
 * pass those checks.
 *
 * Regenerate with: node scripts/generate-social-catalog.mjs
 */
export interface SocialNetworkTemplate {
  readonly name: string;
  readonly uri: string;
  readonly existsStatus: number;
  readonly existsString: string;
  readonly missingStatus: number;
  readonly missingString: string;
  readonly protected: boolean;
}

export const generatedSocialNetworks: readonly SocialNetworkTemplate[] = ${JSON.stringify(entries, null, 2)};
`;

fs.writeFileSync(OUTPUT_PATH, header);
console.log(`Wrote ${entries.length} sites to ${OUTPUT_PATH}`);
