/**
 * The PDF renderer is deliberately pure and deterministic so export auditing can
 * compare bytes for the same evidence bundle. If PDFKit were allowed to choose
 * timestamps or traversal order, investigators could not distinguish real report
 * changes from renderer noise.
 *
 * PDFKit's built-in Helvetica is a Standard-14 font restricted to WinAnsi
 * (Latin-1) encoding -- any character outside that range (Cyrillic, Greek,
 * Vietnamese diacritics) was silently dropped from the page rather than
 * raising an error. Dynamic report content -- titles, finding text, citation
 * labels -- switches to an embedded Noto Sans (which covers those scripts)
 * whenever it contains such a character; static, app-authored labels stay on
 * Helvetica so the common all-English report is visually unchanged. Noto Sans
 * ships as a single variable-font file with no bold instance reachable through
 * pdfkit's registerFont, so text that would have been Helvetica-Bold renders
 * in the same regular weight when the fallback is engaged -- a disclosed
 * trade-off, not a silent one: nothing is dropped, which is the actual bug.
 */
import path from "node:path";
import PDFDocument from "pdfkit";
import type { ReportDocumentModel, ReportFinding, ReportSection } from "./report-model.js";
import type { ReportRenderer } from "./report-renderer.js";

const FIXED_PDF_DATE = new Date("2000-01-01T00:00:00.000Z");
const PAGE_MARGIN = 54;
const BODY_WIDTH = 504;
const REQUIRED_SECTION_ORDER = ["Scans and topology", "Host list"] as const;
const UNICODE_FALLBACK_FONT = "NotoSans";
const UNICODE_FALLBACK_FONT_PATH = "assets/fonts/NotoSans-Variable.ttf";
// Matches any character outside the printable Latin-1 range (space through
// 0xFF) that Helvetica's WinAnsi encoding can represent. Starts at space
// (0x20), not 0x00, so the class excludes control characters and satisfies
// eslint's no-control-regex; written as hex escapes, not a literal high
// character, since this file is parsed as ASCII-safe source.
const NON_LATIN1_PATTERN = /[^\x20-\xFF]/;

const pdfTheme = {
  page: [255, 255, 255] as [number, number, number],
  ink: [11, 16, 22] as [number, number, number],
  muted: [82, 98, 116] as [number, number, number],
  border: [196, 207, 219] as [number, number, number],
  accent: [49, 129, 210] as [number, number, number],
  accentSurface: [232, 244, 255] as [number, number, number]
} as const satisfies Record<string, PDFKit.Mixins.ColorValue>;

export class PdfReportRenderer implements ReportRenderer {
  public constructor(private readonly appRoot: string) {}

  public async render(model: ReportDocumentModel): Promise<Buffer> {
    return renderToBuffer(model, this.appRoot);
  }
}

export function createPdfRenderer(appRoot: string): ReportRenderer {
  return new PdfReportRenderer(appRoot);
}

async function renderToBuffer(model: ReportDocumentModel, appRoot: string): Promise<Buffer> {
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
  document.registerFont(UNICODE_FALLBACK_FONT, path.join(appRoot, UNICODE_FALLBACK_FONT_PATH));
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

/**
 * Picks the fallback font the instant dynamic text carries a character
 * Helvetica cannot encode, so investigator-entered or source-provided content
 * (usernames, addresses, page titles) never silently loses characters.
 */
function bodyFont(text: string, bold: boolean): string {
  return NON_LATIN1_PATTERN.test(text) ? UNICODE_FALLBACK_FONT : bold ? "Helvetica-Bold" : "Helvetica";
}

function renderTitleBlock(document: PDFKit.PDFDocument, model: ReportDocumentModel): void {
  document
    .fillColor(pdfTheme.accent)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text("Reacher report", { characterSpacing: 0.4 });
  document.moveDown(0.6);
  document.fillColor(pdfTheme.ink).font(bodyFont(model.title, false)).fontSize(22).text(model.title, { width: BODY_WIDTH });
  document.moveDown(0.35);
  document.fillColor(pdfTheme.muted).font(bodyFont(model.subtitle, false)).fontSize(11).text(model.subtitle, { width: BODY_WIDTH });
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
      .font(bodyFont(finding.title, true))
      .fontSize(12)
      .fillColor(pdfTheme.ink)
      .text(finding.title, { width: BODY_WIDTH });
    document
      .font("Helvetica")
      .fontSize(9)
      .fillColor(pdfTheme.muted)
      .text(`${finding.itemType} | ${finding.sourceTs}`, { width: BODY_WIDTH });
    document.moveDown(0.25);
    document.font(bodyFont(finding.text, false)).fontSize(10).fillColor(pdfTheme.ink).text(finding.text, { width: BODY_WIDTH, lineGap: 2 });
    document.moveDown(0.25);
    const citationsLine = `Citations: ${citations.length > 0 ? citations.join("; ") : "No citation label"}`;
    document
      .font(bodyFont(citationsLine, true))
      .fontSize(9)
      .fillColor(pdfTheme.accent)
      .text(citationsLine, { width: BODY_WIDTH });
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
    .font(bodyFont(title, true))
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
    .font(bodyFont(text, false))
    .fontSize(10)
    .text(text, PAGE_MARGIN + 16, document.y, { width: BODY_WIDTH - 16, lineGap: 2 });
  document.moveDown(0.35);
}

function renderBodyLine(document: PDFKit.PDFDocument, text: string): void {
  document.fillColor(pdfTheme.ink).font(bodyFont(text, false)).fontSize(10).text(text, { width: BODY_WIDTH, lineGap: 2 });
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
