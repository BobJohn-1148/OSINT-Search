/**
 * Methodology service tests keep the map honest as a coverage checklist. If the
 * export omitted authorization state or smuggled payload generators in, the UI
 * could mislead users during an engagement review.
 */
import { MethodologyService } from "../../src/main/methodology/methodology-service";

it("lists six methodology phases with authorization-aware tools instead of payload generators", () => {
  const result = new MethodologyService().list();
  const text = JSON.stringify(result);

  expect(result.phases.map((phase) => phase.title)).toEqual([
    "Reconnaissance",
    "Scanning and enumeration",
    "Vulnerability analysis",
    "Exploitation readiness",
    "Post-exploitation analysis",
    "Reporting"
  ]);
  expect(result.phases.flatMap((phase) => phase.tools).some((tool) => tool.authorizationRequired)).toBe(true);
  expect(text).not.toMatch(/AmsiScanBuffer|EtwEventWrite|reverse shell|shellcode wrapper|Cobalt Stager|Sliver stager/i);
});

it("exports coverage spreadsheet CSV with framework refs and authorization columns", () => {
  const result = new MethodologyService().exportCsv();

  expect(result.filename).toBe("reacher-methodology-coverage.csv");
  expect(result.csv.split("\n")[0]).toContain("authorization_required");
  expect(result.csv).toContain("OWASP WSTG");
  expect(result.csv).toContain("\"true\"");
});
