/**
 * The report model is shared by PDF and Word so cited observations and derived
 * summaries cannot diverge by renderer. If each format shaped evidence itself,
 * one export could silently omit a citation the other kept.
 */
import type { CaseItem, CaseRecord, CaseSummary } from "../../shared/schemas/cases.js";
import type { ScanHost, ScanRecord, ScanTopology } from "../../shared/schemas/scans.js";

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

export function buildScanReportModel(input: {
  readonly scan: ScanRecord;
  readonly hosts: readonly ScanHost[];
  readonly topology: ScanTopology;
  readonly generatedTs: string;
}): ReportDocumentModel {
  const findings = input.hosts.flatMap((host, index) =>
    host.ports.map((port) => ({
      id: `${host.id}-${port.id}`,
      title: `${host.address}:${port.port}/${port.protocol}`,
      text: `${port.state} ${port.service}${port.product ? ` ${port.product}` : ""}${port.version ? ` ${port.version}` : ""}`.trim(),
      itemType: "scan",
      sourceTs: input.scan.completedTs ?? input.scan.startedTs,
      citations: [{ id: `N${index + 1}`, label: `nmap - ${input.scan.id}` }]
    }))
  );

  return {
    title: `Reacher scan report: ${input.scan.target}`,
    subtitle: `Scan ${input.scan.id} - ${input.scan.status}`,
    generatedTs: input.generatedTs,
    summaryLines: [
      `target: ${input.scan.target}`,
      `hosts: ${input.hosts.length}`,
      `open ports: ${input.hosts.reduce((count, host) => count + host.ports.filter((port) => port.state === "open").length, 0)}`
    ],
    findings,
    sections: [
      {
        title: "Scans and topology",
        lines: input.topology.nodes.map((node) => `${node.label}: ring ${node.ring}, x ${node.x}, y ${node.y}`)
      },
      {
        title: "Host list",
        lines: buildScanHostLines(input.hosts)
      },
      {
        title: "Service list",
        lines: buildScanServiceLines(input.hosts)
      }
    ]
  };
}

function buildScanHostLines(hosts: readonly ScanHost[]): string[] {
  if (hosts.length === 0) {
    return ["No hosts were parsed from this scan."];
  }
  return ["Address | Hostname | Status | Ports", ...hosts.map((host) => `${host.address} | ${host.hostname ?? "no hostname"} | ${host.status} | ${host.ports.length}`)];
}

function buildScanServiceLines(hosts: readonly ScanHost[]): string[] {
  const services = hosts.flatMap((host) =>
    host.ports.map((port) => `${host.address} | ${port.port}/${port.protocol} | ${port.state} | ${port.service || "unknown"} | ${port.product || "unknown"} ${port.version}`.trim())
  );
  return services.length > 0 ? ["Host | Port | State | Service | Product", ...services] : ["No services were parsed from this scan."];
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
