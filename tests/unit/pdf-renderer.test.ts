// @vitest-environment node
/**
 * PDF renderer tests assert rendered bytes because Phase 4 needs stable export
 * artifacts, not only successful method calls. If tests inspected a mock writer,
 * hidden PDF metadata drift could still break audit comparisons.
 *
 * Forced to the node environment (overriding the suite-wide jsdom default):
 * jsdom's realm has its own Uint8Array/ArrayBuffer constructors, and pdfkit's
 * font loader checks `src instanceof Uint8Array` against whichever realm it
 * runs in. A real Node Buffer from fs.readFileSync fails that check under
 * jsdom, so registering a real font file (Noto Sans, for the Unicode
 * fallback) throws "Not a supported font format" purely from the realm
 * mismatch -- not a bug in the renderer itself. The original Helvetica-only
 * renderer never hit this because standard PDF fonts skip fontkit entirely.
 */
import { PDFParse } from "pdf-parse";
import { createPdfRenderer } from "../../src/main/reports/pdf-renderer";
import type { ReportDocumentModel } from "../../src/main/reports/report-model";

const fixture: ReportDocumentModel = {
  title: "Reacher case report: Example target",
  subtitle: "Case case-1 | open",
  generatedTs: "2026-04-05T06:07:08.000Z",
  summaryLines: ["domain: 1", "example.com: strength 2, 1 cited item"],
  findings: [
    {
      id: "finding-later",
      title: "Open service observed",
      text: "InternetDB reported exposed HTTPS on the target.",
      itemType: "observation",
      sourceTs: "2026-04-05T06:06:00.000Z",
      citations: [{ id: "C2", label: "internetdb host-1" }]
    },
    {
      id: "finding-earlier",
      title: "Domain registration observed",
      text: "RDAP identified the registered domain record.",
      itemType: "observation",
      sourceTs: "2026-04-05T06:05:00.000Z",
      citations: [{ id: "C1", label: "rdap domain-1" }]
    }
  ],
  sections: [
    { title: "Host list", lines: ["example.com"] },
    { title: "Scans and topology", lines: ["No scan topology is attached to this case yet."] }
  ]
};

it("renders the required report sections so exported PDFs carry cited evidence", async () => {
  const buffer = await createPdfRenderer(process.cwd()).render(fixture);
  const pdfText = buffer.toString("latin1");
  const visibleText = extractVisiblePdfText(pdfText);

  expect(pdfText).toContain("%PDF-");
  expect(pdfText).toContain("/Count 1");
  expect(visibleText).toContain("Reacher case report: Example target");
  expect(visibleText).toContain("Case case-1 | open");
  expect(visibleText).toContain("Generated 2026-04-05T06:07:08.000Z");
  expect(visibleText).toContain("Summary");
  expect(visibleText).toContain("Findings");
  expect(visibleText).toContain("Domain registration observed");
  expect(visibleText).toContain("Citations: [C1] rdap domain-1");
  expect(visibleText).toContain("Scans and topology");
  expect(visibleText).toContain("Host list");
  expect(visibleText).toContain("example.com");
});

it("renders identical bytes for the same model because metadata and traversal order are fixed", async () => {
  const renderer = createPdfRenderer(process.cwd());
  const first = await renderer.render(fixture);
  const second = await renderer.render(fixture);

  expect(second.equals(first)).toBe(true);
});

it("keeps Cyrillic characters instead of dropping them, by falling back to the embedded Unicode font", async () => {
  // Spells "Profile" and "LiveJournal" (a real site name), so a Cyrillic
  // failure here is legible as itself, not as an opaque escape sequence.
  const cyrillicWord = "Профиль";
  const cyrillicSite = "Живой Журнал";
  const cyrillicFixture: ReportDocumentModel = {
    ...fixture,
    title: `Target ${cyrillicWord}: example`,
    findings: [
      {
        id: "finding-cyrillic",
        title: `Account found on ${cyrillicSite}`,
        text: `A user ${cyrillicWord} was observed on the target site.`,
        itemType: "observation",
        sourceTs: "2026-04-05T06:06:00.000Z",
        citations: [{ id: "C1", label: cyrillicSite }]
      }
    ]
  };

  const buffer = await createPdfRenderer(process.cwd()).render(cyrillicFixture);
  const parser = new PDFParse({ data: buffer });
  try {
    const { text } = await parser.getText();
    expect(text).toContain(cyrillicWord);
    expect(text).toContain(cyrillicSite);
    expect(text).toContain(`Account found on ${cyrillicSite}`);
  } finally {
    await parser.destroy();
  }
});

it("keeps rendering plain ASCII reports on Helvetica so the common case is unchanged", async () => {
  // pdfkit only embeds a registered font's glyph data once something is
  // actually drawn with it, so an all-Latin1 report should carry no trace of
  // the fallback font at all -- not merely render correctly.
  const buffer = await createPdfRenderer(process.cwd()).render(fixture);
  expect(buffer.toString("latin1")).not.toContain("NotoSans");
});

function extractVisiblePdfText(pdfText: string): string {
  return [...pdfText.matchAll(/<([0-9a-fA-F]+)>/g)]
    .map((match) => Buffer.from(match[1], "hex").toString("latin1"))
    .join("");
}
