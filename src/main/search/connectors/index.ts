/**
 * The connector registry is explicit so the source table, orchestrator, and
 * phase audit all see the same passive search spine. If connectors were imported
 * opportunistically, a source could exist in code but never participate in fan-out.
 */
import { abuseIpDbConnector } from "./abuseipdb-connector.js";
import { crtshConnector } from "./crtsh-connector.js";
import { dnsDohConnector } from "./dns-doh-connector.js";
import { githubUserConnector } from "./github-user-connector.js";
import { govSalariesConnector } from "./govsalaries-connector.js";
import { gravatarConnector } from "./gravatar-connector.js";
import { ipinfoConnector } from "./ipinfo-connector.js";
import { ipwhoConnector } from "./ipwho-connector.js";
import { judiciConnector } from "./judici-connector.js";
import { macVendorsConnector } from "./macvendors-connector.js";
import { nvdConnector } from "./nvd-connector.js";
import { phoneOsintConnector } from "./phone-osint-connector.js";
import { rdapConnector } from "./rdap-connector.js";
import { shodanInternetDbConnector } from "./shodan-internetdb-connector.js";
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
  govSalariesConnector,
  judiciConnector,
  phoneOsintConnector,
  githubUserConnector,
  gravatarConnector,
  ipwhoConnector
] as const;
