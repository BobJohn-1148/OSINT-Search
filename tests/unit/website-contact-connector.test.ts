import { websiteContactConnector, extractContactObservations } from "../../src/main/search/connectors/website-contact-connector";

it("extracts public emails, phone numbers, contact pages, and social links from website html", () => {
  const observations = extractContactObservations(
    "example.com",
    "https://example.com",
    `
      <a href="/contact">Contact us</a>
      <a href="https://www.linkedin.com/company/example">LinkedIn</a>
      Email: Info@Example.com
      Call +1 (555) 123-4567
    `
  );

  expect(observations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ type: "email", value: "info@example.com" }),
      expect.objectContaining({ type: "phone", value: "+1 (555) 123-4567" }),
      expect.objectContaining({ type: "contact-page", value: "https://example.com/contact" }),
      expect.objectContaining({ type: "social-profile", value: "https://www.linkedin.com/company/example" })
    ])
  );
});

it("follows relevant internal pages so contact details buried on contact pages are searched", async () => {
  const fetchText = vi.fn((url: string) => {
    if (url === "https://example.com") {
      return Promise.resolve('<a href="/contact">Contact</a>');
    }
    if (url === "https://example.com/contact") {
      return Promise.resolve("Support: support@example.com Phone: 555-010-9999");
    }
    return Promise.resolve("");
  });

  const observations = await websiteContactConnector.run(
    { type: "domain", value: "example.com" },
    { fetchJson: vi.fn(), fetchText }
  );

  expect(fetchText).toHaveBeenCalledWith("https://example.com/contact", expect.any(Object));
  expect(observations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ type: "email", value: "support@example.com" }),
      expect.objectContaining({ type: "phone", value: "555-010-9999" })
    ])
  );
});
