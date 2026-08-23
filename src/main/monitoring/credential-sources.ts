/**
 * Credential sources are explicit adapters so paid providers can degrade before
 * any secret is read. If key checks lived inside the scheduler loop, a missing
 * paid key could fail an otherwise useful XposedOrNot watch check.
 */
import type { KeySource } from "../../shared/types/sources.js";
import type { WatchTargetType } from "../../shared/types/monitoring.js";
import { asRecord, asStringArray, HttpLookupError } from "../search/http.js";

export interface CredentialExposureInput {
  readonly source: string;
  readonly title: string;
  readonly detail: string;
  readonly fingerprint: string;
}

export interface CredentialSourceContext {
  readonly apiKey?: string;
  fetchJson(url: string, init?: RequestInit): Promise<unknown>;
}

export interface CredentialSource {
  readonly id: string;
  readonly label: string;
  readonly keySource?: KeySource;
  readonly requiresKey: boolean;
  supports(type: WatchTargetType): boolean;
  check(type: WatchTargetType, value: string, context: CredentialSourceContext): Promise<readonly CredentialExposureInput[]>;
}

export const credentialSources: readonly CredentialSource[] = [
  {
    id: "xposedornot",
    label: "XposedOrNot",
    requiresKey: false,
    supports: (type) => type === "email",
    check: checkXposedOrNot
  },
  {
    id: "hibp",
    label: "Have I Been Pwned",
    keySource: "hibp",
    requiresKey: true,
    supports: () => true,
    check: checkHibp
  },
  {
    id: "leakcheck",
    label: "LeakCheck",
    keySource: "leakcheck",
    requiresKey: true,
    supports: (type) => type === "email",
    check: checkLeakCheck
  },
  {
    id: "dehashed",
    label: "DeHashed",
    keySource: "dehashed",
    requiresKey: true,
    supports: () => true,
    check: () => Promise.resolve([])
  }
] as const;

async function checkXposedOrNot(
  type: WatchTargetType,
  value: string,
  context: CredentialSourceContext
): Promise<readonly CredentialExposureInput[]> {
  if (type !== "email") {
    return [];
  }
  try {
    const response = asRecord(
      await context.fetchJson(`https://api.xposedornot.com/v1/check-email/${encodeURIComponent(value)}?details=true`)
    );
    return breachNames(response).map((breachName) => ({
      source: "xposedornot",
      title: breachName,
      detail: `XposedOrNot reported ${value} in ${breachName}.`,
      fingerprint: fingerprint("xposedornot", breachName)
    }));
  } catch (error) {
    if (error instanceof HttpLookupError && error.message.includes("HTTP 404")) {
      return [];
    }
    throw error;
  }
}

async function checkHibp(
  type: WatchTargetType,
  value: string,
  context: CredentialSourceContext
): Promise<readonly CredentialExposureInput[]> {
  if (!context.apiKey) {
    return [];
  }
  const path = type === "domain" ? `breacheddomain/${encodeURIComponent(value)}` : `breachedaccount/${encodeURIComponent(value)}`;
  const response = await context.fetchJson(`https://haveibeenpwned.com/api/v3/${path}?truncateResponse=false`, {
    headers: {
      "hibp-api-key": context.apiKey,
      "user-agent": "Reacher local OSINT app"
    }
  });
  const breaches = Array.isArray(response) ? response : Object.values(asRecord(response)).flat();
  return breaches
    .map((entry) => asRecord(entry))
    .map((entry) => firstString(entry.Name, entry.Title, "HIBP breach"))
    .filter((name) => name.length > 0)
    .map((name) => ({
      source: "hibp",
      title: name,
      detail: `Have I Been Pwned reported ${value} in ${name}.`,
      fingerprint: fingerprint("hibp", name)
    }));
}

async function checkLeakCheck(
  type: WatchTargetType,
  value: string,
  context: CredentialSourceContext
): Promise<readonly CredentialExposureInput[]> {
  if (type !== "email" || !context.apiKey) {
    return [];
  }
  const response = asRecord(
    await context.fetchJson(`https://leakcheck.io/api/v2/query/${encodeURIComponent(value)}`, {
      headers: {
        "X-API-Key": context.apiKey,
        accept: "application/json"
      }
    })
  );
  const result = Array.isArray(response.result) ? response.result : [];
  return result.map(asRecord).map((entry) => {
    const sourceValue = typeof entry.source === "object" && entry.source !== null ? asRecord(entry.source).name : entry.source;
    const source = firstString(sourceValue, "LeakCheck exposure");
    return {
      source: "leakcheck",
      title: source,
      detail: `LeakCheck reported ${value} in ${source}.`,
      fingerprint: fingerprint("leakcheck", source)
    };
  });
}

function breachNames(response: Record<string, unknown>): string[] {
  const flatBreaches = asStringArray(response.breaches);
  if (flatBreaches.length > 0) {
    return unique(flatBreaches);
  }
  if (Array.isArray(response.breaches)) {
    return unique(response.breaches.flatMap((entry) => asStringArray(entry)));
  }

  const analytics = asRecord(response.ExposedBreaches);
  const details = Array.isArray(analytics.breaches_details) ? analytics.breaches_details : [];
  return unique(details.map(asRecord).map((entry) => firstString(entry.breach, entry.breach_name, entry.name, "")));
}

function unique(values: readonly string[]): string[] {
  return values.map((value) => value.trim()).filter((value, index, all) => value.length > 0 && all.indexOf(value) === index);
}

function fingerprint(source: string, title: string): string {
  return `${source}:${title.trim().toLowerCase()}`;
}

function firstString(...values: readonly unknown[]): string {
  const value = values.find((entry) => typeof entry === "string" || typeof entry === "number");
  return value === undefined ? "" : String(value);
}
