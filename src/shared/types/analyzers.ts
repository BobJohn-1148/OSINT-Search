/**
 * Analyzer types keep passive imports and lookups separate from active scans so
 * file parsing cannot accidentally inherit network-scan authorization behavior.
 * If analyzer names were loose strings, save-to-case rows would lose provenance.
 */
export const analyzerFindingTypeValues = ["event", "packet", "dork", "mac", "vulnerability", "file", "ioc", "email"] as const;

/** Authentication-Results verdicts for an email's SPF/DKIM/DMARC checks. */
export const emailAuthVerdictValues = ["pass", "fail", "softfail", "neutral", "none", "temperror", "permerror", "unknown"] as const;
export const evtxLevelValues = ["critical", "error", "warning", "information", "verbose", "unknown"] as const;

/**
 * IOC kinds double as the routing table between a static artifact and the
 * correlation search: each kind maps to a seed type in ioc-extractor so an
 * indicator pulled from a binary can be searched without the user retyping it.
 * "unknown" is kept so an indicator that is real but unseedable still surfaces
 * as evidence instead of being silently dropped.
 */
export const iocKindValues = [
  "url",
  "domain",
  "ipv4",
  "ipv6",
  "email",
  "btc-wallet",
  "eth-wallet",
  "registry-key",
  "windows-path",
  "mutex",
  "pdb-path",
  "unknown"
] as const;

export type AnalyzerFindingType = (typeof analyzerFindingTypeValues)[number];
export type EvtxLevel = (typeof evtxLevelValues)[number];
export type IocKind = (typeof iocKindValues)[number];
export type EmailAuthVerdict = (typeof emailAuthVerdictValues)[number];
