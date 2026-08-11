/**
 * DOCX renderer tests read the generated Word XML because investigators verify
 * report substance, not implementation objects. If these tests only asserted a
 * buffer exists, a renderer could omit citations while still producing a file.
 */
import JSZip from "jszip";
import { DocxReportRenderer } from "../../src/main/reports/docx-renderer";
import type { ReportDocumentModel } from "../../src/main/reports/report-model";

it("renders the required report sections and citation labels because Word exports must carry portable evidence", async () => {
  const xml = await renderDocumentXml(fixtureModel());
  const text = documentText(xml);

  expect(text).toContain("Reacher case report: Alpha");
  expect(text).toContain("Case case-alpha - open");
  expect(text).toContain("Generated: 2026-08-10T12:00:00.000Z");
  expect(text).toContain("Summary");
  expect(text).toContain("- observation: 2");
  expect(text).toContain("Findings");
  expect(text).toContain("Domain observed");
  expect(text).toContain("Citations: C1 dns-doh example.com");
  expect(text).toContain("Scans and topology");
  expect(text).toContain("- No scan topology is attached to this case yet.");
  expect(text).toContain("Host list");
  expect(text).toContain("- 192.0.2.10 web01");
});

it("sorts findings and citations deterministically because audit exports need stable traversal", async () => {
  const xml = await renderDocumentXml({
    ...fixtureModel(),
    findings: [
      {
        id: "finding-b",
        title: "Later finding",
        text: "Second in time.",
        itemType: "observation",
        sourceTs: "2026-08-10T12:10:00.000Z",
        citations: [
          { id: "C2", label: "second source" },
          { id: "C1", label: "first source" }
        ]
      },
      {
        id: "finding-a",
        title: "Earlier finding",
        text: "First in time.",
        itemType: "observation",
        sourceTs: "2026-08-10T12:00:00.000Z",
        citations: [{ id: "C3", label: "third source" }]
      }
    ]
  });
  const text = documentText(xml);

  expect(text.indexOf("Earlier finding")).toBeLessThan(text.indexOf("Later finding"));
  expect(text).toContain("Citations: C1 first source; C2 second source");
});

async function renderDocumentXml(model: ReportDocumentModel): Promise<string> {
  const buffer = await new DocxReportRenderer().render(model);
  expect(buffer.subarray(0, 2).toString()).toBe("PK");

  const zip = await JSZip.loadAsync(buffer);
  const documentXml = zip.file("word/document.xml");
  expect(documentXml).not.toBeNull();
  return documentXml?.async("string") ?? "";
}

function documentText(xml: string): string {
  return [...xml.matchAll(/<w:t[^>]*>(.*?)<\/w:t>/gu)]
    .map((match) => unescapeXml(match[1]))
    .join("\n");
}

function unescapeXml(value: string): string {
  return value
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function fixtureModel(): ReportDocumentModel {
  return {
    title: "Reacher case report: Alpha",
    subtitle: "Case case-alpha - open",
    generatedTs: "2026-08-10T12:00:00.000Z",
    summaryLines: ["observation: 2", "example.com: strength 2, 2 cited items"],
    findings: [
      {
        id: "finding-domain",
        title: "Domain observed",
        text: "example.com resolved during passive collection.",
        itemType: "observation",
        sourceTs: "2026-08-10T11:00:00.000Z",
        citations: [{ id: "C1", label: "dns-doh example.com" }]
      }
    ],
    sections: [
      {
        title: "Scans and topology",
        lines: ["No scan topology is attached to this case yet."]
      },
      {
        title: "Host list",
        lines: ["192.0.2.10 web01"]
      }
    ]
  };
}
