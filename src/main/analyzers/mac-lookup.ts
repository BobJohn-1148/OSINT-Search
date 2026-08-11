/**
 * MAC lookup normalizes addresses before consulting offline OUI data because
 * vendor matching should not depend on punctuation. If raw user input became
 * the lookup key, common address formats would fail and fall back online.
 */
import type { MacLookupResult } from "../../shared/schemas/analyzers.js";
import { offlineOuiVendors } from "./oui-data.js";

export type MacVendorFetch = (oui: string) => Promise<string | null>;

export async function lookupMacVendor(mac: string, fetchVendor?: MacVendorFetch): Promise<MacLookupResult> {
  const normalized = normalizeMac(mac);
  const oui = normalized.slice(0, 6);
  const offline = offlineOuiVendors[oui];
  if (offline) {
    return { mac, oui, vendor: offline, source: "offline" };
  }
  const fallback = await fetchVendor?.(oui);
  return { mac, oui, vendor: fallback ?? "Unknown vendor", source: fallback ? "macvendors" : "offline" };
}

export function normalizeMac(mac: string): string {
  return mac.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
}
