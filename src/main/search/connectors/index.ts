/**
 * The connector registry is explicit so the source table, orchestrator, and
 * phase audit all see the same passive search spine. If connectors were imported
 * opportunistically, a source could exist in code but never participate in fan-out.
 */
import { abuseIpDbConnector } from "./abuseipdb-connector.js";
import { crtshConnector } from "./crtsh-connector.js";
import { dnsDohConnector } from "./dns-doh-connector.js";
import { ipinfoConnector } from "./ipinfo-connector.js";
import { macVendorsConnector } from "./macvendors-connector.js";
import { nvdConnector } from "./nvd-connector.js";
import { osint4AllCatalogConnector } from "./osint4all-catalog-connector.js";
import { rdapConnector } from "./rdap-connector.js";
import { scrapeGraphConnector } from "./scrapegraph-connector.js";
import { shodanInternetDbConnector } from "./shodan-internetdb-connector.js";
import { websiteContactConnector } from "./website-contact-connector.js";
import { xposedOrNotConnector } from "./xposedornot-connector.js";
import type { SourceConnector } from "../source-connector.js";

export const searchConnectors: readonly SourceConnector[] = [
  rdapConnector,
  dnsDohConnector,
  crtshConnector,
  shodanInternetDbConnector,
  ipinfoConnector,
  abuseIpDbConnector,
  xposedOrNotConnector,
  macVendorsConnector,
  nvdConnector,
  websiteContactConnector,
  osint4AllCatalogConnector,
  scrapeGraphConnector
] as const;
