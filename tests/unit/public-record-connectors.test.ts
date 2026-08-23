/**
 * Public-record connectors should create explicit lookup handoffs, not pretend
 * that external sites returned person-verified results. These tests keep the
 * source registry useful while preserving that boundary.
 */
import { govSalariesConnector } from "../../src/main/search/connectors/govsalaries-connector";
import { judiciConnector } from "../../src/main/search/connectors/judici-connector";
import { searchConnectors } from "../../src/main/search/connectors";
import type { SourceRunContext } from "../../src/main/search/source-connector";

const fetchJson = vi.fn<SourceRunContext["fetchJson"]>();
const context: SourceRunContext = {
  fetchJson
};

beforeEach(() => {
  fetchJson.mockReset();
});

it("generates verified public-record lookup links for a person name without network scraping", async () => {
  const govSalaries = await govSalariesConnector.run({ type: "name", value: " John  Smith " }, context);
  const judici = await judiciConnector.run({ type: "name", value: " John  Smith " }, context);

  expect(fetchJson).not.toHaveBeenCalled();
  expect(govSalaries).toEqual([
    {
      entity: "public-record:govsalaries:john smith",
      type: "public-salary-lookup",
      value: "GovSalaries employee lookup for John Smith",
      source: "govsalaries",
      raw: {
        query: "John Smith",
        lookupUrl: "https://govsalaries.com/search?employee=John+Smith",
        homeUrl: "https://govsalaries.com/",
        recordsAdvertised: "150M+",
        employersAdvertised: "60.8k",
        fcraRestricted: true,
        note: "External public-record lookup; verify identity before treating salary records as a match."
      }
    }
  ]);
  expect(judici).toEqual([
    {
      entity: "public-record:judici:john smith",
      type: "court-record-lookup",
      value: "Judici participating-court lookup for John Smith",
      source: "judici",
      raw: {
        query: "John Smith",
        lookupUrl: "https://www.judici.com/courts/court_list.jsp",
        homeUrl: "https://www.judici.com/index.jsp",
        mode: "select participating court, then search within that court",
        participatingCourts: 82,
        availableData: [
          "litigant info",
          "criminal charges, dispositions and sentences",
          "civil judgments",
          "fines, fees, balances, and payment details",
          "hearing dates",
          "case minutes",
          "will indexes",
          "documents"
        ],
        note: "Judici public access is court-scoped; choose the relevant participating court before searching the name."
      }
    }
  ]);
});

it("registers public-record sources for name and business searches only", () => {
  const publicSources = searchConnectors.filter((connector) => connector.category === "public-records");

  expect(publicSources.map((connector) => connector.id).sort()).toEqual(["govsalaries", "judici"]);
  expect(publicSources.every((connector) => connector.supports("name"))).toBe(true);
  expect(publicSources.every((connector) => connector.supports("business"))).toBe(true);
  expect(publicSources.every((connector) => !connector.supports("email"))).toBe(true);
});
