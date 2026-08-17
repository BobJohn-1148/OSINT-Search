import { isAppNavigationUrl, normalizeExternalHttpUrl } from "../../src/main/security/external-navigation";

it("allows only local app navigations inside the Electron window", () => {
  expect(isAppNavigationUrl("file:///C:/app/index.html", undefined)).toBe(true);
  expect(isAppNavigationUrl("http://localhost:5173/search", "http://localhost:5173")).toBe(true);
  expect(isAppNavigationUrl("https://www.revshells.com/", "http://localhost:5173")).toBe(false);
});

it("normalizes only browser-safe external http links", () => {
  expect(normalizeExternalHttpUrl("https://www.revshells.com/")).toBe("https://www.revshells.com/");
  expect(normalizeExternalHttpUrl("http://example.com/path")).toBe("http://example.com/path");
  expect(normalizeExternalHttpUrl("javascript:alert(1)")).toBeNull();
  expect(normalizeExternalHttpUrl("file:///C:/Windows/System32/cmd.exe")).toBeNull();
  expect(normalizeExternalHttpUrl("not a url")).toBeNull();
});
