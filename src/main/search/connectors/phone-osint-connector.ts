/**
 * Phone OSINT is one connector that answers a phone seed with two kinds of
 * evidence: what the number itself proves (valid NANP shape, area-code region,
 * E.164 form) derived offline, and a curated set of reputable free reverse-lookup
 * handoffs seeded with the number. It exists because before it a phone search
 * matched no connector at all and fell back to dumping domain/cert tools that
 * have nothing to do with a phone number.
 *
 * It is keyless and passive by design: the derived facts come from a local
 * area-code table, and the lookup tools are external sites the investigator
 * opens — Reacher never claims a match it did not actually retrieve, mirroring
 * the govsalaries/judici public-record handoff pattern.
 */
import type { ObservationInput, SearchSeed } from "../../../shared/types/search.js";
import type { SourceConnector } from "../source-connector.js";
import { regionForAreaCode } from "./nanp-area-codes.js";

const sourceId = "phone-osint";

interface ParsedPhone {
  readonly e164: string;
  readonly countryCode: string;
  readonly national: string;
  readonly areaCode: string | null;
  readonly isNanp: boolean;
}

/**
 * Free, passive reverse-phone lookups. Each entry builds a URL from the number;
 * the investigator opens it — Reacher does not scrape or authenticate. Kept to
 * reputable directories and search handoffs, not social-account enumeration, so
 * the set stays inside lawful OSINT.
 */
const phoneTools: readonly {
  readonly id: string;
  readonly label: string;
  readonly url: (phone: ParsedPhone) => string;
}[] = [
  { id: "truecaller", label: "Truecaller", url: (p) => `https://www.truecaller.com/search/us/${p.national}` },
  { id: "numlookup", label: "NumLookup", url: (p) => `https://www.numlookup.com/results?phone=${encodeURIComponent(p.e164)}` },
  { id: "freecarrierlookup", label: "FreeCarrierLookup", url: () => "https://freecarrierlookup.com/" },
  { id: "sync-me", label: "Sync.me", url: (p) => `https://sync.me/search/?number=${encodeURIComponent(p.e164)}` },
  { id: "whitepages", label: "Whitepages reverse phone", url: (p) => `https://www.whitepages.com/phone/${p.countryCode}-${p.national}` },
  { id: "spydialer", label: "SpyDialer", url: () => "https://www.spydialer.com/" },
  { id: "whocalld", label: "WhoCalld", url: (p) => `https://whocalld.com/+${p.countryCode}${p.national}` },
  { id: "800notes", label: "800notes spam reports", url: (p) => `https://800notes.com/Phone.aspx/1-${p.national}` },
  { id: "usphonebook", label: "USPhoneBook", url: (p) => `https://www.usphonebook.com/${p.national}` },
  { id: "nuwber", label: "Nuwber", url: (p) => `https://nuwber.com/search?phone=${encodeURIComponent(p.e164)}` },
  { id: "google-dork", label: "Google exact-match", url: (p) => `https://www.google.com/search?q=${encodeURIComponent(`"${p.national}" OR "${formatUsPretty(p.national)}"`)}` },
  { id: "epieos", label: "Epieos reverse lookup", url: () => "https://epieos.com/" }
];

export const phoneOsintConnector: SourceConnector = {
  id: sourceId,
  label: "Phone OSINT",
  category: "identity",
  tier: "passive",
  keyRequired: false,
  supports(seedType) {
    return seedType === "phone";
  },
  run(seed: SearchSeed) {
    const phone = parsePhone(seed.value);
    if (phone === null) {
      return Promise.resolve([
        {
          entity: `phone:${digitsOnly(seed.value)}`,
          type: "phone-format",
          value: `Could not parse "${seed.value}" as a phone number`,
          source: sourceId,
          raw: { input: seed.value, valid: false }
        }
      ] satisfies ObservationInput[]);
    }

    const observations: ObservationInput[] = [];
    const region = phone.areaCode ? regionForAreaCode(phone.areaCode) : null;

    observations.push({
      entity: `phone:${phone.e164}`,
      type: "phone-format",
      value: `${phone.e164}${phone.isNanp ? " (valid NANP)" : ""}`,
      source: sourceId,
      raw: {
        e164: phone.e164,
        countryCode: phone.countryCode,
        national: phone.national,
        areaCode: phone.areaCode,
        isNanp: phone.isNanp,
        valid: true
      }
    });

    if (region) {
      // A region backed by the local table is a real derived fact and a pivot
      // seed the investigator can push into name/business search for the area.
      observations.push({
        entity: `phone-region:${region.toLowerCase()}`,
        type: "phone-region",
        value: `Area code ${phone.areaCode} — ${region}`,
        source: sourceId,
        raw: { areaCode: phone.areaCode, region, pivotSeed: { type: "business", value: region } }
      });
    } else if (phone.areaCode) {
      observations.push({
        entity: `phone-areacode:${phone.areaCode}`,
        type: "phone-region",
        value: `Area code ${phone.areaCode} (region not in local table)`,
        source: sourceId,
        raw: { areaCode: phone.areaCode, region: null }
      });
    }

    for (const tool of phoneTools) {
      observations.push({
        entity: `phone-osint-tool:${tool.id}`,
        type: "phone-osint-tool",
        value: `${tool.label} — reverse lookup for ${phone.e164}`,
        source: sourceId,
        raw: { tool: tool.id, lookupUrl: tool.url(phone), passive: true }
      });
    }

    return Promise.resolve(observations satisfies ObservationInput[]);
  }
};

function digitsOnly(value: string): string {
  return value.replace(/[^\d]/g, "");
}

/**
 * Parse to E.164 without a dependency. NANP (US/Canada, country code 1) is the
 * table-backed common case; other lengths are still normalized to a best-effort
 * E.164 with a null area code so the tool handoffs work internationally, but no
 * region is asserted for them.
 */
function parsePhone(input: string): ParsedPhone | null {
  const hasPlus = input.trim().startsWith("+");
  let digits = digitsOnly(input);
  if (digits.length === 0) {
    return null;
  }

  // NANP: 10 digits, or 11 digits starting with a 1.
  if (digits.length === 10) {
    digits = `1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    const national = digits.slice(1);
    const areaCode = national.slice(0, 3);
    // NANP NPA/NXX rule: area code and exchange both start 2-9.
    const isNanp = /^[2-9]\d\d[2-9]\d{6}$/.test(national);
    return { e164: `+1${national}`, countryCode: "1", national, areaCode, isNanp };
  }

  // Non-NANP or unusual length: keep as best-effort international E.164.
  if (digits.length >= 8 && digits.length <= 15) {
    return { e164: `+${digits}`, countryCode: hasPlus ? inferCountryCode(digits) : "", national: digits, areaCode: null, isNanp: false };
  }
  return null;
}

function inferCountryCode(digits: string): string {
  // Only the unambiguous single-digit codes are inferred; anything else is left
  // blank rather than guessed, since country-code lengths overlap.
  return digits.startsWith("1") ? "1" : digits.startsWith("7") ? "7" : "";
}

function formatUsPretty(national: string): string {
  return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
}
