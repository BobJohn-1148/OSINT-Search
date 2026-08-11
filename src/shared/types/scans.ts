/**
 * Scan types are explicit because active nmap options must stay selectable and
 * auditable instead of becoming arbitrary command text. If scan builders accepted
 * loose strings, the authorization gate could approve one target while another
 * command shape actually ran.
 */
export const scanTypeValues = ["ping-sweep", "quick-top-100", "full-tcp", "service-version", "os-detect", "vuln-nse", "custom"] as const;
export const scanTimingValues = ["T2", "T3", "T4"] as const;
export const scanStatusValues = ["running", "succeeded", "failed", "blocked"] as const;

export type ScanType = (typeof scanTypeValues)[number];
export type ScanTiming = (typeof scanTimingValues)[number];
export type ScanStatus = (typeof scanStatusValues)[number];
