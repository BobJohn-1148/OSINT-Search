/**
 * Report types stay tiny because the report pipeline is a deterministic export
 * of case evidence, not a second evidence store. If formats carried independent
 * shapes, PDF and Word output could disagree about citations.
 */
export const reportFormatValues = ["pdf", "docx"] as const;

export type ReportFormat = (typeof reportFormatValues)[number];
