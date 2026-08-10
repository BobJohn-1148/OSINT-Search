/**
 * crt.sh contributes certificate transparency names that often corroborate
 * domains discovered elsewhere. Its public JSON endpoint can return duplicate
 * or partial rows, so parsing stays defensive to keep certificate noise from
 * destabilizing the passive search run.
 */
import type { ObservationInput, SearchSeed, SeedType } from "../../../shared/types/search.js";
import { asRecord, asString } from "../http.js";
import type { SourceConnector, SourceRunContext } from "../source-connector.js";

const SOURCE_ID = "crtsh";

export const crtshConnector: SourceConnector = {
  id: SOURCE_ID,
  label: "crt.sh",
  category: "domain",
  tier: "passive",
  keyRequired: false,
  supports(seedType: SeedType): boolean {
    return seedType === "domain";
  },
  async run(seed: SearchSeed, context: SourceRunContext): Promise<readonly ObservationInput[]> {
    const url = new URL("https://crt.sh/");
    url.searchParams.set("q", seed.value);
    url.searchParams.set("output", "json");
    const payload = await context.fetchJson(url.toString(), { signal: context.signal });

    return parseCertificateRows(seed, payload);
  }
};

function parseCertificateRows(seed: SearchSeed, payload: unknown): ObservationInput[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  const observations: ObservationInput[] = [];
  for (const row of payload) {
    const record = asRecord(row);
    const issuer = asString(record.issuer_name);
    const notBefore = asString(record.not_before);
    const notAfter = asString(record.not_after);

    for (const name of certificateNames(record)) {
      observations.push({
        entity: name,
        type: "certificate-name",
        value: name,
        source: SOURCE_ID,
        raw: {
          issuer,
          notBefore,
          notAfter
        }
      });
    }
  }

  return dedupeObservations(observations);
}

function certificateNames(record: Record<string, unknown>): string[] {
  const names = new Set<string>();
  const commonName = normalizeCertificateName(asString(record.common_name));
  if (commonName !== null) {
    names.add(commonName);
  }

  const nameValue = asString(record.name_value);
  if (nameValue !== null) {
    for (const line of nameValue.split(/\r?\n/u)) {
      const normalized = normalizeCertificateName(line);
      if (normalized !== null) {
        names.add(normalized);
      }
    }
  }

  return [...names].sort();
}

function normalizeCertificateName(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const trimmed = value.trim().toLowerCase().replace(/^\*\./u, "");
  return /^[a-z0-9.-]+\.[a-z]{2,}$/u.test(trimmed) ? trimmed : null;
}

function dedupeObservations(observations: readonly ObservationInput[]): ObservationInput[] {
  const seen = new Set<string>();
  return observations.filter((entry) => {
    const key = `${entry.entity}\u0000${entry.type}\u0000${entry.value}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
