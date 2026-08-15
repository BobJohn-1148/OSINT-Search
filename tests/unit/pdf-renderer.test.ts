/**
 * PDF renderer tests assert rendered bytes because Phase 4 needs stable export
 * artifacts, not only successful method calls. If tests inspected a mock writer,
 * hidden PDF metadata drift could still break audit comparisons.
 */
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
  const buffer = await createPdfRenderer().render(fixture);
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
  const renderer = createPdfRenderer();
  const first = await renderer.render(fixture);
  const second = await renderer.render(fixture);

  expect(second.equals(first)).toBe(true);
});

function extractVisiblePdfText(pdfText: string): string {
  return [...pdfText.matchAll(/<([0-9a-fA-F]+)>/g)]
    .map((match) => Buffer.from(match[1], "hex").toString("latin1"))
    .join("");
}
