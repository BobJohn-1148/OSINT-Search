/**
 * The report model is shared by PDF and Word so cited observations and derived
 * summaries cannot diverge by renderer. If each format shaped evidence itself,
 * one export could silently omit a citation the other kept.
 */
import type { CaseItem, CaseRecord, CaseSummary } from "../../shared/schemas/cases.js";

export interface ReportCitation {
  readonly id: string;
  readonly label: string;
}

export interface ReportFinding {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  readonly itemType: string;
  readonly sourceTs: string;
  readonly citations: readonly ReportCitation[];
}

export interface ReportSection {
  readonly title: string;
  readonly lines: readonly string[];
}

export interface ReportDocumentModel {
  readonly title: string;
  readonly subtitle: string;
  readonly generatedTs: string;
  readonly summaryLines: readonly string[];
  readonly findings: readonly ReportFinding[];
  readonly sections: readonly ReportSection[];
}

export function buildCaseReportModel(input: {
  readonly caseRecord: CaseRecord;
  readonly timeline: readonly CaseItem[];
  readonly summary: CaseSummary;
  readonly generatedTs: string;
}): ReportDocumentModel {
  const findings = [...input.timeline]
    .sort((a, b) => a.sourceTs.localeCompare(b.sourceTs) || a.id.localeCompare(b.id))
    .map((item, index) => ({
      id: item.id,
      title: item.title,
      text: item.text,
      itemType: item.itemType,
      sourceTs: item.sourceTs,
      citations: [toCitation(item, index + 1)]
    }));

  return {
    title: `Reacher case report: ${input.caseRecord.title}`,
    subtitle: `Case ${input.caseRecord.id} - ${input.caseRecord.status}`,
    generatedTs: input.generatedTs,
    summaryLines: buildSummaryLines(input.summary),
    findings,
    sections: [
      {
        title: "Scans and topology",
        lines: ["No scan topology is attached to this case yet."]
      },
      {
        title: "Host list",
        lines: ["No hosts are attached to this case yet."]
      }
    ]
  };
}

function buildSummaryLines(summary: CaseSummary): string[] {
  const counts = Object.entries(summary.counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, count]) => `${type}: ${count}`);
  const entities = summary.keyEntities.map(
    (entity) => `${entity.entity}: strength ${entity.strength}, ${entity.count} cited item${entity.count === 1 ? "" : "s"}`
  );
  return [...counts, ...(entities.length > 0 ? entities : ["No key entities yet."])];
}

function toCitation(item: CaseItem, index: number): ReportCitation {
  const source = typeof item.metadata.sourceId === "string" ? item.metadata.sourceId : item.itemType;
  const ref = item.refId ? ` - ${item.refId}` : "";
  return {
    id: `C${index}`,
    label: `${source}${ref}`
  };
}
