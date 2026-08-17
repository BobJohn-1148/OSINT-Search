import {
  osint4AllCatalogConnector,
  parseOsint4AllCatalog,
  selectRelevantLinks
} from "../../src/main/search/connectors/osint4all-catalog-connector";

const sampleCatalog = `
OSINT4ALL
=========

## PHONE

[PhoneInfoga](https://github.com/sundowndev/phoneinfoga)

## EMAIL

[theHarvester](https://pypi.org/project/theHarvester/)

## DOMAIN / IP / DNS

[urlscan.io](https://urlscan.io/)

## USERNAME

[WhatsMyName](https://whatsmyname.app/)
`;

it("parses the OSINT4ALL markdown mirror into categorized links", () => {
  expect(parseOsint4AllCatalog(sampleCatalog)).toEqual([
    { category: "PHONE", title: "PhoneInfoga", url: "https://github.com/sundowndev/phoneinfoga" },
    { category: "EMAIL", title: "theHarvester", url: "https://pypi.org/project/theHarvester/" },
    { category: "DOMAIN / IP / DNS", title: "urlscan.io", url: "https://urlscan.io/" },
    { category: "USERNAME", title: "WhatsMyName", url: "https://whatsmyname.app/" }
  ]);
});

it("selects catalog links relevant to the current seed type", () => {
  const catalog = parseOsint4AllCatalog(sampleCatalog);

  expect(selectRelevantLinks({ type: "phone", value: "+15551234567" }, catalog).map((link) => link.title)).toContain("PhoneInfoga");
  expect(selectRelevantLinks({ type: "email", value: "a@example.com" }, catalog).map((link) => link.title)).toContain("theHarvester");
  expect(selectRelevantLinks({ type: "domain", value: "example.com" }, catalog).map((link) => link.title)).toContain("urlscan.io");
  expect(selectRelevantLinks({ type: "username", value: "jdoe" }, catalog).map((link) => link.title)).toContain("WhatsMyName");
});

it("adds relevant OSINT4ALL tools as observations during normal search fan-out", async () => {
  const observations = await osint4AllCatalogConnector.run(
    { type: "domain", value: "example.com" },
    {
      fetchJson: vi.fn(),
      fetchText: vi.fn(() => Promise.resolve(sampleCatalog))
    }
  );

  expect(observations).toEqual([
    expect.objectContaining({
      entity: "example.com",
      type: "osint-tool",
      value: "urlscan.io — https://urlscan.io/",
      source: "osint4all-catalog"
    })
  ]);
});
