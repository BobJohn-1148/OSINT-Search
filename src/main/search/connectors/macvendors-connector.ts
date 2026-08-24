/**
 * MAC Vendors is a plain-text passive lookup, so this connector keeps the text
 * fetch contained at the edge while still returning Reacher observations. If a
 * string-only service were pushed through JSON helpers, a valid vendor response
 * would look like a connector failure and hide hardware evidence from searches.
 */
import { HttpLookupError, asString } from "../http.js";
import type { SourceConnector } from "../source-connector.js";

const sourceId = "macvendors";

export const macVendorsConnector: SourceConnector = {
  id: sourceId,
  label: "MAC Vendors",
  category: "hardware",
  tier: "passive",
  keyRequired: false,
  supports(seedType) {
    return seedType === "mac";
  },
  async run(seed, context) {
    if (seed.type !== "mac") {
      return [];
    }

    const mac = normalizeMac(seed.value);
    if (mac === null) {
      return [];
    }

    const vendor = await fetchVendor(mac, context.signal);
    if (vendor === null) {
      return [];
    }

    return [
      {
        entity: `vendor:${vendor.toLowerCase()}`,
        type: "hardware-vendor",
        value: vendor,
        source: sourceId,
        raw: {
          mac,
          oui: mac.slice(0, 8)
        }
      }
    ];
  }
};

async function fetchVendor(mac: string, signal?: AbortSignal): Promise<string | null> {
  const response = await fetch(`https://api.macvendors.com/${encodeURIComponent(mac)}`, {
    headers: {
      "accept": "text/plain",
      "user-agent": "Reacher local OSINT app"
    },
    signal
  });

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new HttpLookupError(`HTTP ${response.status} from api.macvendors.com`, response.status, await response.text().catch(() => ""));
  }

  return asString((await response.text()).trim());
}

function normalizeMac(value: string): string | null {
  const hex = value.replace(/[^a-f0-9]/gi, "").toUpperCase();
  if (!/^[A-F0-9]{12}$/.test(hex)) {
    return null;
  }

  return hex.match(/.{2}/g)?.join(":") ?? null;
}
