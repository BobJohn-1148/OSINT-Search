/**
 * HTTP helpers keep passive connectors small and failure-isolated. If every
 * connector hand-rolled fetch parsing, one unexpected response shape could throw
 * outside the orchestrator and stop unrelated sources from returning.
 */
export class HttpLookupError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "HttpLookupError";
  }
}

export async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const headers = new Headers(init?.headers);
  // Default the accept header rather than forcing it: Cloudflare's DoH JSON API
  // answers 400 to "application/json" and needs "application/dns-json", and
  // overwriting the caller here silently cost every domain search its DNS
  // evidence. Connectors that say nothing still get JSON.
  if (!headers.has("accept")) {
    headers.set("accept", "application/json");
  }
  headers.set("user-agent", "Reacher local OSINT app");

  const response = await fetch(url, {
    ...init,
    headers
  });

  if (!response.ok) {
    throw new HttpLookupError(`HTTP ${response.status} from ${new URL(url).hostname}`);
  }

  return response.json();
}

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}
