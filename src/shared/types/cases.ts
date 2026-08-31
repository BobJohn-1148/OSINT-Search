/**
 * Case item types are explicit because evidence must stay polymorphic without
 * becoming arbitrary JSON. If saved work used loose strings, later reports and
 * agent memory would not know which rows are observations, scans, or notes.
 */
export const caseStatusValues = ["open", "archived"] as const;
export const caseItemTypeValues = ["observation", "scan", "tool_run", "agent_run", "note", "report", "pattern_finding"] as const;

export type CaseStatus = (typeof caseStatusValues)[number];
export type CaseItemType = (typeof caseItemTypeValues)[number];
