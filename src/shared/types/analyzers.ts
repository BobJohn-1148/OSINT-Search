/**
 * Analyzer types keep passive imports and lookups separate from active scans so
 * file parsing cannot accidentally inherit network-scan authorization behavior.
 * If analyzer names were loose strings, save-to-case rows would lose provenance.
 */
export const analyzerFindingTypeValues = ["event", "packet", "dork", "mac", "vulnerability"] as const;
export const evtxLevelValues = ["critical", "error", "warning", "information", "verbose", "unknown"] as const;

export type AnalyzerFindingType = (typeof analyzerFindingTypeValues)[number];
export type EvtxLevel = (typeof evtxLevelValues)[number];
