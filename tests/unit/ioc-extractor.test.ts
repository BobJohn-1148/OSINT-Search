/**
 * IOC extraction is the bridge back into correlation search, so two properties
 * are pinned: indicators come out with the right seed type (or explicitly none),
 * and the noisy false positives that would drown a real pivot — filenames read
 * as domains, IP fragments, a URL's host re-counted as a bare domain — stay out.
 */
import { extractIocs, extractStrings, selectNotableStrings } from "../../src/main/analyzers/ioc-extractor";

it("extracts ASCII and wide (UTF-16LE) strings so config stored as wide chars is not missed", () => {
  const ascii = Buffer.from("this is a visible ascii marker");
  const wide = Buffer.from("SecretMutexName".split("").map((char) => `${char}\0`).join(""), "latin1");
  const strings = extractStrings(Buffer.concat([ascii, Buffer.from([0, 0]), wide]));
  expect(strings.some((value) => value.includes("visible ascii marker"))).toBe(true);
  expect(strings).toContain("SecretMutexName");
});

it("maps network indicators to the seed types search understands so they can be pivoted", () => {
  const iocs = extractIocs([
    "beacon url https://evil.example.com/gate.php",
    "contact operator@bad.test for keys",
    "callback 203.0.113.45 then exit"
  ]);
  const byKind = new Map(iocs.map((ioc) => [ioc.kind, ioc]));
  expect(byKind.get("url")?.seedType).toBe("domain");
  expect(byKind.get("email")?.value).toBe("operator@bad.test");
  expect(byKind.get("email")?.seedType).toBe("email");
  expect(byKind.get("ipv4")?.value).toBe("203.0.113.45");
  expect(byKind.get("ipv4")?.seedType).toBe("ip");
});

it("does not re-count a URL's host as a standalone domain so one indicator is one row", () => {
  const iocs = extractIocs(["download from https://cdn.evil.example/payload.bin"]);
  const domains = iocs.filter((ioc) => ioc.kind === "domain");
  // The host lives inside the matched URL and must not also appear as a bare domain.
  expect(domains.some((ioc) => ioc.value === "cdn.evil.example")).toBe(false);
  expect(iocs.some((ioc) => ioc.kind === "url")).toBe(true);
});

it("rejects filenames and IP fragments that look like domains so pivots are not polluted", () => {
  const iocs = extractIocs(["loads kernel32.dll and ntdll.dll", "version 10.0.19041 build"]);
  const domains = iocs.filter((ioc) => ioc.kind === "domain").map((ioc) => ioc.value);
  expect(domains).not.toContain("kernel32.dll");
  expect(domains).not.toContain("ntdll.dll");
  // A dotted version string is not a domain and its octets are out of IPv4 range.
  expect(iocs.some((ioc) => ioc.value === "10.0.19041")).toBe(false);
});

it("flags wallets as evidence-only because a wallet is a lead, not a searchable seed", () => {
  const iocs = extractIocs([
    "ransom to 1BoatSLRHtKNngkdXEeobR76b53LETtpyT now",
    "or eth 0x52908400098527886E0F7030069857D2E4169EE7"
  ]);
  const wallets = iocs.filter((ioc) => ioc.kind === "btc-wallet" || ioc.kind === "eth-wallet");
  expect(wallets.length).toBe(2);
  expect(wallets.every((ioc) => ioc.seedType === null)).toBe(true);
});

it("counts occurrences and sorts by frequency so the loudest indicator leads", () => {
  const iocs = extractIocs([
    "c2 is https://one.example.test/a",
    "again https://one.example.test/a",
    "rare https://two.example.test/b"
  ]);
  const top = iocs.find((ioc) => ioc.kind === "url");
  expect(top?.value).toBe("https://one.example.test/a");
  expect(top?.occurrences).toBe(2);
});

it("keeps notable strings clear of structured IOCs so the list is not a duplicate dump", () => {
  const strings = ["MyProductName v2.1", "https://evil.example.com/x", "Mozilla/5.0 compatible"];
  const iocs = extractIocs(strings);
  const notable = selectNotableStrings(strings, iocs);
  expect(notable).toContain("MyProductName v2.1");
  expect(notable).not.toContain("https://evil.example.com/x");
});
