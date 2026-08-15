/**
 * Source identifiers are centralized because keys, providers, and later
 * connectors must talk about the same external services. If each phase invented
 * its own strings, a stored key could be invisible to the connector that needs it.
 */
export const keySourceValues = [
  "openai",
  "xai",
  "anthropic",
  "ollama",
  "lm-studio",
  "shodan",
  "censys",
  "ipinfo",
  "greynoise",
  "abuseipdb",
  "securitytrails",
  "hunter",
  "emailrep",
  "xposedornot",
  "hibp",
  "leakcheck",
  "dehashed",
  "snusbase",
  "intelx",
  "numverify",
  "twilio",
  "opencorporates",
  "companies-house",
  "nvd",
  "vulners",
  "maclookup",
  "virustotal",
  "otx",
  "urlscan",
  "abuse-ch",
  "openweb-ninja",
  "bright-data",
  "tineye",
  "pimeyes"
] as const;

export type KeySource = (typeof keySourceValues)[number];
