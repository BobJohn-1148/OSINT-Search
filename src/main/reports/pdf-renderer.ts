/**
 * The PDF renderer is deliberately pure and deterministic so export auditing can
 * compare bytes for the same evidence bundle. If PDFKit were allowed to choose
 * timestamps or traversal order, investigators could not distinguish real report
 * changes from renderer noise.
 */
import PDFDocument from "pdfkit";
import type { ReportDocumentModel, ReportFinding, ReportSection } from "./report-model.js";
import type { ReportRenderer } from "./report-renderer.js";

const FIXED_PDF_DATE = new Date("2000-01-01T00:00:00.000Z");
const PAGE_MARGIN = 54;
const BODY_WIDTH = 504;
const REQUIRED_SECTION_ORDER = ["Scans and topology", "Host list"] as const;

const pdfTheme = {
  page: [255, 255, 255] as [number, number, number],
  ink: [11, 16, 22] as [number, number, number],
  muted: [82, 98, 116] as [number, number, number],
  border: [196, 207, 219] as [number, number, number],
  accent: [49, 129, 210] as [number, number, number],
  accentSurface: [232, 244, 255] as [number, number, number]
} as const satisfies Record<string, PDFKit.Mixins.ColorValue>;

export class PdfReportRenderer implements ReportRenderer {
  public async render(model: ReportDocumentModel): Promise<Buffer> {
    return renderToBuffer(model);
  }
}

export function createPdfRenderer(): ReportRenderer {
  return new PdfReportRenderer();
}

export async function renderPdfReport(model: ReportDocumentModel): Promise<Buffer> {
  return renderToBuffer(model);
}

async function renderToBuffer(model: ReportDocumentModel): Promise<Buffer> {
  const document = new PDFDocument({
    autoFirstPage: true,
    bufferPages: true,
    compress: false,
    margin: PAGE_MARGIN,
    size: "LETTER",
    info: {
      Title: model.title,
      Author: "Reacher",
      Subject: "Cited OSINT report",
      Keywords: "reacher,osint,case-report,citations",
      Creator: "Reacher PDF renderer",
      Producer: "Reacher PDF renderer",
      CreationDate: FIXED_PDF_DATE,
      ModDate: FIXED_PDF_DATE
    }
  });
  const chunks: Buffer[] = [];
  document.on("data", (chunk: Buffer) => chunks.push(chunk));
  const finished = onceFinished(document);

  paintPageBackground(document);
  renderTitleBlock(document, model);
  renderSummary(document, model.summaryLines);
  renderFindings(document, orderedFindings(model.findings));
  renderSections(document, orderedSections(model.sections));
  renderPageFooters(document);

  document.end();
  await finished;
  return Buffer.concat(chunks);
}

function renderTitleBlock(document: PDFKit.PDFDocument, model: ReportDocumentModel): void {
  document
    .fillColor(pdfTheme.accent)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text("Reacher report", { characterSpacing: 0.4 });
  document.moveDown(0.6);
  document.fillColor(pdfTheme.ink).fontSize(22).text(model.title, { width: BODY_WIDTH });
  document.moveDown(0.35);
  document.fillColor(pdfTheme.muted).font("Helvetica").fontSize(11).text(model.subtitle, { width: BODY_WIDTH });
  document.moveDown(0.2);
  document.text(`Generated ${model.generatedTs}`, { width: BODY_WIDTH });
  document.moveDown(1.2);
}

function renderSummary(document: PDFKit.PDFDocument, summaryLines: readonly string[]): void {
  renderSectionHeading(document, "Summary");
  const lines = summaryLines.length > 0 ? [...summaryLines].sort((a, b) => a.localeCompare(b)) : ["No summary lines yet."];
  for (const line of lines) {
    renderBullet(document, line);
  }
  document.moveDown(0.8);
}

function renderFindings(document: PDFKit.PDFDocument, findings: readonly ReportFinding[]): void {
  renderSectionHeading(document, "Findings");
  if (findings.length === 0) {
    renderBodyLine(document, "No cited findings are attached to this report yet.");
    document.moveDown(0.8);
    return;
  }

  for (const finding of findings) {
    ensureSpace(document, 92);
    const citations = orderedCitations(finding.citations).map((citation) => `[${citation.id}] ${citation.label}`);
    document
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor(pdfTheme.ink)
      .text(finding.title, { width: BODY_WIDTH });
    document
      .font("Helvetica")
      .fontSize(9)
      .fillColor(pdfTheme.muted)
      .text(`${finding.itemType} | ${finding.sourceTs}`, { width: BODY_WIDTH });
    document.moveDown(0.25);
    document.fontSize(10).fillColor(pdfTheme.ink).text(finding.text, { width: BODY_WIDTH, lineGap: 2 });
    document.moveDown(0.25);
    document
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(pdfTheme.accent)
      .text(`Citations: ${citations.length > 0 ? citations.join("; ") : "No citation label"}`, { width: BODY_WIDTH });
    document.moveDown(0.75);
  }
}

function renderSections(document: PDFKit.PDFDocument, sections: readonly ReportSection[]): void {
  for (const section of sections) {
    ensureSpace(document, 76);
    renderSectionHeading(document, section.title);
    for (const line of section.lines.length > 0 ? section.lines : ["No entries yet."]) {
      renderBullet(document, line);
    }
    document.moveDown(0.8);
  }
}

function renderSectionHeading(document: PDFKit.PDFDocument, title: string): void {
  ensureSpace(document, 48);
  document
    .roundedRect(PAGE_MARGIN, document.y, BODY_WIDTH, 24, 4)
    .fill(pdfTheme.accentSurface);
  document
    .fillColor(pdfTheme.accent)
    .font("Helvetica-Bold")
    .fontSize(12)
    .text(title, PAGE_MARGIN + 10, document.y + 6, { width: BODY_WIDTH - 20 });
  document.y += 14;
  document.moveDown(0.6);
}

function renderBullet(document: PDFKit.PDFDocument, text: string): void {
  ensureSpace(document, 32);
  const bulletY = document.y + 4;
  document.circle(PAGE_MARGIN + 4, bulletY, 2).fill(pdfTheme.accent);
  document
    .fillColor(pdfTheme.ink)
    .font("Helvetica")
    .fontSize(10)
    .text(text, PAGE_MARGIN + 16, document.y, { width: BODY_WIDTH - 16, lineGap: 2 });
  document.moveDown(0.35);
}

function renderBodyLine(document: PDFKit.PDFDocument, text: string): void {
  document.fillColor(pdfTheme.ink).font("Helvetica").fontSize(10).text(text, { width: BODY_WIDTH, lineGap: 2 });
}

function renderPageFooters(document: PDFKit.PDFDocument): void {
  const range = document.bufferedPageRange();
  for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex += 1) {
    document.switchToPage(pageIndex);
    document
      .moveTo(PAGE_MARGIN, 720)
      .lineTo(PAGE_MARGIN + BODY_WIDTH, 720)
      .lineWidth(0.5)
      .strokeColor(pdfTheme.border)
      .stroke();
    document
      .font("Helvetica")
      .fontSize(8)
      .fillColor(pdfTheme.muted)
      .text(`Reacher | Page ${pageIndex + 1} of ${range.count}`, PAGE_MARGIN, 728, {
        width: BODY_WIDTH,
        align: "right",
        lineBreak: false
      });
  }
}

function ensureSpace(document: PDFKit.PDFDocument, minimumHeight: number): void {
  if (document.y + minimumHeight <= 700) {
    return;
  }
  document.addPage();
  paintPageBackground(document);
}

function paintPageBackground(document: PDFKit.PDFDocument): void {
  document.rect(0, 0, document.page.width, document.page.height).fill(pdfTheme.page);
  document.x = PAGE_MARGIN;
  document.y = PAGE_MARGIN;
}

function orderedFindings(findings: readonly ReportFinding[]): ReportFinding[] {
  return [...findings].sort(
    (a, b) =>
      a.sourceTs.localeCompare(b.sourceTs) ||
      a.id.localeCompare(b.id) ||
      a.title.localeCompare(b.title)
  );
}

function orderedCitations(citations: ReportFinding["citations"]): ReportFinding["citations"] {
  return [...citations].sort((a, b) => a.id.localeCompare(b.id) || a.label.localeCompare(b.label));
}

function orderedSections(sections: readonly ReportSection[]): ReportSection[] {
  const byTitle = new Map(sections.map((section) => [section.title, section]));
  const required = REQUIRED_SECTION_ORDER.map((title) => byTitle.get(title) ?? { title, lines: ["No entries yet."] });
  const rest = sections
    .filter((section) => !REQUIRED_SECTION_ORDER.includes(section.title as (typeof REQUIRED_SECTION_ORDER)[number]))
    .sort((a, b) => a.title.localeCompare(b.title));
  return [...required, ...rest];
}

async function onceFinished(document: PDFKit.PDFDocument): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    document.once("end", resolve);
    document.once("error", reject);
  });
}
