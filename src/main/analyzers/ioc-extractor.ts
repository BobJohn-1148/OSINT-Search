/**
 * String and IOC extraction is the bridge from a dead binary back into the
 * correlation core: every indicator it pulls carries the seed type search
 * already understands, so a domain lifted from a sample can be pivoted without
 * the investigator retyping it. That is the whole reason malware triage lives
 * inside an OSINT tool instead of beside one.
 *
 * Extraction is pure and bounded — it takes a Buffer, never a path or a process
 * — so it is trivially testable and cannot become a second way to touch disk.
 */
import type { Ioc } from "../../shared/schemas/analyzers.js";
import type { IocKind } from "../../shared/types/analyzers.js";
import type { SeedType } from "../../shared/types/search.js";

const MIN_STRING_LENGTH = 5;
const MAX_STRINGS = 20_000; // Bound the scan so a huge file cannot exhaust memory.

/**
 * Extract printable ASCII and UTF-16LE strings. Malware routinely stores its
 * config as wide strings, so scanning only ASCII would miss the URLs and
 * mutexes that matter most.
 */
export function extractStrings(buffer: Buffer, minLength = MIN_STRING_LENGTH): string[] {
  const results: string[] = [];
  appendAsciiStrings(buffer, minLength, results);
  appendUtf16Strings(buffer, minLength, results);
  return results.slice(0, MAX_STRINGS);
}

function appendAsciiStrings(buffer: Buffer, minLength: number, out: string[]): void {
  let current = "";
  for (let index = 0; index < buffer.length && out.length < MAX_STRINGS; index += 1) {
    const byte = buffer[index];
    if (byte >= 0x20 && byte <= 0x7e) {
      current += String.fromCharCode(byte);
      continue;
    }
    if (current.length >= minLength) {
      out.push(current);
    }
    current = "";
  }
  if (current.length >= minLength) {
    out.push(current);
  }
}

function appendUtf16Strings(buffer: Buffer, minLength: number, out: string[]): void {
  let current = "";
  // Step by 2 looking for printable-ASCII-then-NUL pairs, the common shape of
  // Windows wide strings holding config data.
  for (let index = 0; index + 1 < buffer.length && out.length < MAX_STRINGS; index += 2) {
    const low = buffer[index];
    const high = buffer[index + 1];
    if (high === 0x00 && low >= 0x20 && low <= 0x7e) {
      current += String.fromCharCode(low);
      continue;
    }
    if (current.length >= minLength) {
      out.push(current);
    }
    current = "";
  }
  if (current.length >= minLength) {
    out.push(current);
  }
}

interface IocPattern {
  readonly kind: IocKind;
  readonly seedType: SeedType | null;
  readonly regex: RegExp;
  readonly normalize?: (value: string) => string;
  readonly reject?: (value: string) => boolean;
}

// Ordered by specificity: a URL is matched and consumed before its bare host can
// be re-counted as a standalone domain, so one indicator is not double-reported.
const IOC_PATTERNS: readonly IocPattern[] = [
  { kind: "url", seedType: "domain", regex: /\bhttps?:\/\/[^\s"'<>)\]}]+/gi },
  { kind: "email", seedType: "email", regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, normalize: (value) => value.toLowerCase() },
  { kind: "ipv4", seedType: "ip", regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, reject: (value) => !isValidIpv4(value) },
  { kind: "ipv6", seedType: "ip", regex: /\b(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}\b/g },
  { kind: "eth-wallet", seedType: null, regex: /\b0x[a-fA-F0-9]{40}\b/g },
  { kind: "btc-wallet", seedType: null, regex: /\b(?:bc1[a-z0-9]{25,39}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b/g },
  { kind: "registry-key", seedType: null, regex: /\b(?:HKLM|HKCU|HKCR|HKU|HKEY_[A-Z_]+)\\[^\s"'<>)\]}]+/g },
  { kind: "pdb-path", seedType: null, regex: /\b[A-Za-z]:\\[^\s"'<>)\]}]+\.pdb\b/gi },
  { kind: "windows-path", seedType: null, regex: /\b[A-Za-z]:\\(?:[^\s"'<>)\]}\\]+\\)*[^\s"'<>)\]}\\]+\.(?:exe|dll|bat|ps1|vbs|scr|sys)\b/gi },
  { kind: "domain", seedType: "domain", regex: /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}\b/gi, normalize: (value) => value.toLowerCase(), reject: (value) => !isPlausibleDomain(value) }
];

export function extractIocs(strings: readonly string[]): Ioc[] {
  const counts = new Map<string, { kind: IocKind; seedType: SeedType | null; value: string; occurrences: number }>();
  const claimed = new Set<string>();

  for (const pattern of IOC_PATTERNS) {
    for (const line of strings) {
      const matches = line.match(pattern.regex);
      if (!matches) {
        continue;
      }
      for (const raw of matches) {
        const value = pattern.normalize ? pattern.normalize(raw) : raw;
        if (pattern.reject?.(value)) {
          continue;
        }
        // A domain already inside a matched URL/email is not a second indicator.
        if (pattern.kind === "domain" && isSubstringOfClaimed(value, claimed)) {
          continue;
        }
        const key = `${pattern.kind}:${value}`;
        const existing = counts.get(key);
        if (existing) {
          existing.occurrences += 1;
        } else {
          counts.set(key, { kind: pattern.kind, seedType: pattern.seedType, value, occurrences: 1 });
        }
        if (pattern.kind === "url" || pattern.kind === "email") {
          claimed.add(value.toLowerCase());
        }
      }
    }
  }

  return [...counts.values()]
    .map((entry) => ({ kind: entry.kind, value: entry.value, seedType: entry.seedType, occurrences: entry.occurrences }))
    .sort((left, right) => right.occurrences - left.occurrences || left.value.localeCompare(right.value));
}

function isSubstringOfClaimed(domain: string, claimed: ReadonlySet<string>): boolean {
  for (const value of claimed) {
    if (value.includes(domain)) {
      return true;
    }
  }
  return false;
}

function isValidIpv4(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 4) {
    return false;
  }
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) {
      return false;
    }
    const numeric = Number(part);
    return numeric >= 0 && numeric <= 255;
  });
}

const COMMON_FILE_EXTENSIONS = new Set([
  "dll",
  "exe",
  "sys",
  "bat",
  "cmd",
  "ini",
  "log",
  "tmp",
  "dat",
  "bin",
  "txt",
  "png",
  "jpg",
  "gif",
  "css",
  "js",
  "json",
  "xml",
  "html"
]);

/**
 * The domain pattern is greedy on purpose, so it needs a rejector: a filename
 * like "kernel32.dll" is not an internet domain. Rejecting when the final label
 * is a known file extension removes the overwhelming majority of false hits
 * without a full public-suffix list.
 */
function isPlausibleDomain(value: string): boolean {
  const labels = value.split(".");
  if (labels.length < 2) {
    return false;
  }
  const tld = labels[labels.length - 1].toLowerCase();
  if (COMMON_FILE_EXTENSIONS.has(tld)) {
    return false;
  }
  if (/^\d+$/.test(tld)) {
    return false; // A trailing all-numeric label means this was an IP fragment.
  }
  return labels.every((label) => label.length > 0 && label.length <= 63);
}

/**
 * Strings worth surfacing verbatim in the report: long, mostly-printable, and
 * not already captured as a structured IOC. Kept short and deduplicated so the
 * "notable strings" list stays scannable instead of dumping the whole binary.
 */
export function selectNotableStrings(strings: readonly string[], iocs: readonly Ioc[], limit = 40): string[] {
  const iocValues = new Set(iocs.map((ioc) => ioc.value.toLowerCase()));
  const seen = new Set<string>();
  const notable: string[] = [];
  for (const value of strings) {
    if (notable.length >= limit) {
      break;
    }
    const trimmed = value.trim();
    if (trimmed.length < 8 || trimmed.length > 200) {
      continue;
    }
    const lower = trimmed.toLowerCase();
    if (seen.has(lower) || iocValues.has(lower)) {
      continue;
    }
    if (!/[a-z]/i.test(trimmed)) {
      continue; // Skip runs of punctuation or hex noise.
    }
    seen.add(lower);
    notable.push(trimmed);
  }
  return notable;
}
