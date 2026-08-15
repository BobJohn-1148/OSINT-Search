/**
 * Word reports walk the shared report model directly so DOCX exports preserve
 * the same cited-evidence contract as every other format. If this renderer
 * reshaped case data itself, citation order and required audit sections could
 * drift from the PDF and from the durable case timeline.
 */
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from "docx";
import type { FileChild } from "docx";
import type { ReportDocumentModel, ReportFinding, ReportSection } from "./report-model.js";
import type { ReportRenderer } from "./report-renderer.js";

const REQUIRED_SECTIONS: readonly ReportSection[] = [
  {
    title: "Scans and topology",
    lines: ["No scan topology is attached to this report yet."]
  },
  {
    title: "Host list",
    lines: ["No hosts are attached to this report yet."]
  }
];

export class DocxReportRenderer implements ReportRenderer {
  public async render(model: ReportDocumentModel): Promise<Buffer> {
    return renderToBuffer(model);
  }
}

export function createDocxRenderer(): ReportRenderer {
  return new DocxReportRenderer();
}

export async function renderDocxReport(model: ReportDocumentModel): Promise<Buffer> {
  return renderToBuffer(model);
}

async function renderToBuffer(model: ReportDocumentModel): Promise<Buffer> {
  const document = new Document({
    creator: "Reacher",
    lastModifiedBy: "Reacher",
    title: model.title,
    subject: model.subtitle,
    description: "Reacher case report export",
    sections: [
      {
        properties: {},
        children: buildDocumentChildren(model)
      }
    ]
  });

  return Packer.toBuffer(document);
}

function buildDocumentChildren(model: ReportDocumentModel): FileChild[] {
  return [
    heading(model.title, HeadingLevel.TITLE),
    paragraph(model.subtitle, { italics: true }),
    paragraph(`Generated: ${model.generatedTs}`),
    spacer(),
    heading("Summary", HeadingLevel.HEADING_1),
    ...listLines(orderedSummaryLines(model.summaryLines)),
    spacer(),
    heading("Findings", HeadingLevel.HEADING_1),
    ...buildFindings(sortedFindings(model.findings)),
    ...buildSections(visibleSections(model.sections))
  ];
}

function buildFindings(findings: readonly ReportFinding[]): FileChild[] {
  if (findings.length === 0) {
    return [paragraph("No findings are attached to this report yet.")];
  }

  return findings.flatMap((finding, index) => [
    heading(`${index + 1}. ${finding.title}`, HeadingLevel.HEADING_2),
    metadataTable([
      ["Type", finding.itemType],
      ["Source timestamp", finding.sourceTs]
    ]),
    paragraph(finding.text),
    paragraph(`Citations: ${citationText(finding)}`),
    spacer()
  ]);
}

function buildSections(sections: readonly ReportSection[]): FileChild[] {
  return sections.flatMap((section) => [
    heading(section.title, HeadingLevel.HEADING_1),
    ...listLines(section.lines),
    spacer()
  ]);
}

function visibleSections(sections: readonly ReportSection[]): ReportSection[] {
  const required = REQUIRED_SECTIONS.map((requiredSection) => {
    const provided = sections.find((section) => section.title === requiredSection.title);
    return provided ?? requiredSection;
  });
  const additional = sections.filter(
    (section) => !REQUIRED_SECTIONS.some((requiredSection) => requiredSection.title === section.title)
  ).sort((a, b) => a.title.localeCompare(b.title));
  return [...required, ...additional];
}

function sortedFindings(findings: readonly ReportFinding[]): ReportFinding[] {
  return [...findings].sort(
    (a, b) =>
      a.sourceTs.localeCompare(b.sourceTs) ||
      a.id.localeCompare(b.id) ||
      a.title.localeCompare(b.title)
  );
}

function orderedSummaryLines(lines: readonly string[]): string[] {
  return [...lines].sort((a, b) => a.localeCompare(b));
}

function citationText(finding: ReportFinding): string {
  const citations = [...finding.citations].sort((a, b) => a.id.localeCompare(b.id) || a.label.localeCompare(b.label));
  if (citations.length === 0) {
    return "No citations attached";
  }
  return citations.map((citation) => `${citation.id} ${citation.label}`).join("; ");
}

function listLines(lines: readonly string[]): Paragraph[] {
  if (lines.length === 0) {
    return [paragraph("No entries yet.")];
  }
  return lines.map((line) => paragraph(`- ${line}`));
}

function metadataTable(rows: readonly (readonly [string, string])[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      ([label, value]) =>
        new TableRow({
          children: [
            new TableCell({ children: [paragraph(label, { bold: true })] }),
            new TableCell({ children: [paragraph(value)] })
          ]
        })
    )
  });
}

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]): Paragraph {
  return new Paragraph({
    heading: level,
    children: [new TextRun(text)]
  });
}

function paragraph(text: string, options: { readonly bold?: boolean; readonly italics?: boolean } = {}): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.START,
    spacing: { after: 120 },
    children: [
      new TextRun({
        text,
        bold: options.bold,
        italics: options.italics
      })
    ]
  });
}

function spacer(): Paragraph {
  return new Paragraph({ text: "" });
}
