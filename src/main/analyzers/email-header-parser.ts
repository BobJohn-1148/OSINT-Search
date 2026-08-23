/**
 * Email header analysis is pure string work over pasted headers, so it lives in
 * one in-process parser with no network and no execution — the same "inspect,
 * never act" boundary the malware triage uses. It reconstructs the delivery path
 * from the Received chain (which is stored newest-first, so the origin is the
 * LAST entry), reads the SPF/DKIM/DMARC verdicts the receiving MTA already
 * computed, and flags the sender mismatches that mark a spoof. Every risk point
 * is named, because the verdict is the reasons, not the number.
 */
import type { EmailAuthResult, EmailHeaderReport, EmailHop } from "../../shared/schemas/analyzers.js";
import type { EmailAuthVerdict } from "../../shared/types/analyzers.js";

interface HeaderLine {
  readonly name: string;
  readonly value: string;
}

export function parseEmailHeaders(raw: string): EmailHeaderReport {
  const headers = unfoldHeaders(raw);
  const received = headers.filter((header) => header.name === "received").map((header) => header.value);
  const from = firstHeader(headers, "from");
  const returnPath = stripAngles(firstHeader(headers, "return-path"));
  const replyTo = firstHeader(headers, "reply-to");
  const auth = parseAuthentication(headers);

  // Received headers are prepended by each MTA, so the file order is newest →
  // oldest. Reversing gives the delivery path origin → recipient.
  const hops = buildHops([...received].reverse());
  const originHop = hops.length > 0 ? hops[0] : null;

  const fromDomain = emailDomain(from);
  const returnPathDomain = emailDomain(returnPath);
  const replyToDomain = emailDomain(replyTo);
  const totalTransitSeconds = computeTotalTransit(hops);

  const spoofing = detectSpoofing({ fromDomain, returnPathDomain, replyToDomain, auth });
  const { riskScore, riskReasons } = scoreRisk({ auth, spoofing, hops });

  return {
    from,
    fromDomain,
    returnPath,
    returnPathDomain,
    replyTo,
    replyToDomain,
    subject: firstHeader(headers, "subject"),
    date: firstHeader(headers, "date"),
    messageId: stripAngles(firstHeader(headers, "message-id")),
    originatingIp: originHop?.ip ?? null,
    originatingHost: originHop?.fromHost ?? null,
    hops,
    totalTransitSeconds,
    auth,
    spoofingIndicators: spoofing,
    riskScore,
    riskReasons
  };
}

/** Join RFC 5322 folded headers (continuation lines start with whitespace). */
function unfoldHeaders(raw: string): HeaderLine[] {
  // Only the header block matters; a blank line ends it.
  const headerBlock = raw.replace(/\r\n/g, "\n").split(/\n\n/, 1)[0] ?? raw.replace(/\r\n/g, "\n");
  const lines = headerBlock.split("\n");
  const unfolded: string[] = [];
  for (const line of lines) {
    if (/^[ \t]/.test(line) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += ` ${line.trim()}`;
    } else {
      unfolded.push(line);
    }
  }
  const headers: HeaderLine[] = [];
  for (const line of unfolded) {
    const colon = line.indexOf(":");
    if (colon <= 0) {
      continue;
    }
    headers.push({ name: line.slice(0, colon).trim().toLowerCase(), value: line.slice(colon + 1).trim() });
  }
  return headers;
}

function firstHeader(headers: readonly HeaderLine[], name: string): string | null {
  return headers.find((header) => header.name === name)?.value ?? null;
}

function buildHops(orderedReceived: readonly string[]): EmailHop[] {
  const raw = orderedReceived.map((value, index) => {
    const timestamp = extractTimestamp(value);
    return {
      index,
      fromHost: extractField(value, /from\s+([^\s(;]+)/i),
      byHost: extractField(value, /by\s+([^\s(;]+)/i),
      protocol: extractField(value, /with\s+([^\s(;]+)/i),
      ip: extractIp(value),
      epoch: timestamp ? Date.parse(timestamp) : NaN,
      timestamp
    };
  });

  return raw.map((hop, index) => {
    const previous = index > 0 ? raw[index - 1] : null;
    const delaySeconds =
      previous && Number.isFinite(hop.epoch) && Number.isFinite(previous.epoch)
        ? Math.max(0, Math.round((hop.epoch - previous.epoch) / 1000))
        : null;
    return {
      index,
      fromHost: hop.fromHost,
      byHost: hop.byHost,
      org: registrableDomain(hop.fromHost) ?? registrableDomain(hop.byHost),
      protocol: hop.protocol,
      timestamp: hop.timestamp,
      delaySeconds,
      ip: hop.ip
    };
  });
}

function extractField(value: string, pattern: RegExp): string | null {
  const match = pattern.exec(value);
  return match ? match[1].replace(/[<>]/g, "") : null;
}

function extractIp(value: string): string | null {
  const ipv4 = /\[?((?:\d{1,3}\.){3}\d{1,3})\]?/.exec(value);
  if (ipv4 && isValidIpv4(ipv4[1])) {
    return ipv4[1];
  }
  const ipv6 = /\[?((?:[A-Fa-f0-9]{1,4}:){2,7}[A-Fa-f0-9]{1,4})\]?/.exec(value);
  return ipv6 ? ipv6[1] : null;
}

function extractTimestamp(value: string): string | null {
  // The date follows the final semicolon in a Received header.
  const semi = value.lastIndexOf(";");
  if (semi < 0) {
    return null;
  }
  const candidate = value.slice(semi + 1).trim();
  const parsed = Date.parse(candidate);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function computeTotalTransit(hops: readonly EmailHop[]): number | null {
  const stamps = hops.map((hop) => (hop.timestamp ? Date.parse(hop.timestamp) : NaN)).filter((value) => Number.isFinite(value));
  if (stamps.length < 2) {
    return null;
  }
  return Math.max(0, Math.round((Math.max(...stamps) - Math.min(...stamps)) / 1000));
}

function parseAuthentication(headers: readonly HeaderLine[]): EmailAuthResult {
  const authLine = headers
    .filter((header) => header.name === "authentication-results" || header.name === "arc-authentication-results")
    .map((header) => header.value)
    .join("; ");
  const spf = verdict(/spf=(\w+)/i.exec(authLine)?.[1]) ?? receivedSpf(headers);
  const dkim = verdict(/dkim=(\w+)/i.exec(authLine)?.[1]) ?? (headers.some((header) => header.name === "dkim-signature") ? "unknown" : "none");
  const dmarc = verdict(/dmarc=(\w+)/i.exec(authLine)?.[1]) ?? "none";
  return { spf, dkim, dmarc };
}

function receivedSpf(headers: readonly HeaderLine[]): EmailAuthVerdict {
  const line = firstHeader(headers, "received-spf");
  if (!line) {
    return "none";
  }
  return verdict(line.split(/\s+/, 1)[0]) ?? "none";
}

function verdict(value: string | undefined): EmailAuthVerdict | null {
  if (!value) {
    return null;
  }
  const normalized = value.toLowerCase();
  const allowed: readonly EmailAuthVerdict[] = ["pass", "fail", "softfail", "neutral", "none", "temperror", "permerror"];
  return allowed.find((entry) => entry === normalized) ?? "unknown";
}

function detectSpoofing(input: {
  readonly fromDomain: string | null;
  readonly returnPathDomain: string | null;
  readonly replyToDomain: string | null;
  readonly auth: EmailAuthResult;
}): string[] {
  const indicators: string[] = [];
  if (input.fromDomain && input.returnPathDomain && input.fromDomain !== input.returnPathDomain) {
    indicators.push(`From domain (${input.fromDomain}) does not match Return-Path (${input.returnPathDomain})`);
  }
  if (input.fromDomain && input.replyToDomain && input.fromDomain !== input.replyToDomain) {
    indicators.push(`Reply-To domain (${input.replyToDomain}) differs from From (${input.fromDomain})`);
  }
  if (input.auth.spf === "fail" || input.auth.spf === "softfail") {
    indicators.push(`SPF ${input.auth.spf} — sending server not authorized by the From domain`);
  }
  if (input.auth.dkim === "fail") {
    indicators.push("DKIM signature failed — message may have been altered or forged");
  }
  if (input.auth.dmarc === "fail") {
    indicators.push("DMARC failed — the domain owner's policy rejects this alignment");
  }
  return indicators;
}

function scoreRisk(input: {
  readonly auth: EmailAuthResult;
  readonly spoofing: readonly string[];
  readonly hops: readonly EmailHop[];
}): { readonly riskScore: number; readonly riskReasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  if (input.auth.dmarc === "fail") {
    score += 35;
    reasons.push("DMARC failed");
  } else if (input.auth.dmarc === "none") {
    score += 8;
    reasons.push("No DMARC result present");
  }
  if (input.auth.spf === "fail") {
    score += 25;
    reasons.push("SPF failed");
  } else if (input.auth.spf === "softfail") {
    score += 15;
    reasons.push("SPF softfail");
  } else if (input.auth.spf === "none") {
    score += 8;
    reasons.push("No SPF result present");
  }
  if (input.auth.dkim === "fail") {
    score += 20;
    reasons.push("DKIM failed");
  }
  // Each sender-alignment mismatch beyond the auth verdicts adds weight.
  const alignmentIndicators = input.spoofing.filter((indicator) => indicator.includes("does not match") || indicator.includes("differs"));
  if (alignmentIndicators.length > 0) {
    score += Math.min(20, alignmentIndicators.length * 12);
    reasons.push(`${alignmentIndicators.length} sender-address mismatch(es)`);
  }
  if (input.hops.length === 0) {
    reasons.push("No Received hops parsed — headers may be incomplete");
  }
  if (reasons.length === 0) {
    reasons.push("Authentication passed and sender addresses align");
  }
  return { riskScore: Math.min(100, score), riskReasons: reasons };
}

function stripAngles(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const match = /<([^>]+)>/.exec(value);
  return match ? match[1] : value.trim() || null;
}

function emailDomain(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const address = /<([^>]+)>/.exec(value)?.[1] ?? value;
  const at = address.lastIndexOf("@");
  if (at < 0) {
    return null;
  }
  const domain = address
    .slice(at + 1)
    .trim()
    .replace(/[>;,\s].*$/, "")
    .toLowerCase();
  return domain || null;
}

/**
 * Best-effort registrable domain for organization inference. Handles the common
 * two-label public suffixes (co.uk, com.au, …) without shipping a full public
 * suffix list, which is more than enough to name the org in a hop.
 */
function registrableDomain(host: string | null): string | null {
  if (!host) {
    return null;
  }
  const labels = host.toLowerCase().replace(/\.$/, "").split(".");
  if (labels.length < 2) {
    return null;
  }
  const twoLabelSuffixes = new Set(["co.uk", "com.au", "co.jp", "co.nz", "com.br", "co.in", "org.uk", "gov.uk", "ac.uk"]);
  const lastTwo = labels.slice(-2).join(".");
  if (twoLabelSuffixes.has(lastTwo) && labels.length >= 3) {
    return labels.slice(-3).join(".");
  }
  return lastTwo;
}

function isValidIpv4(value: string): boolean {
  const parts = value.split(".");
  return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
