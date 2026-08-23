/**
 * Email header parser tests pin the two things a phishing trace lives or dies on:
 * the Received chain is reconstructed origin → recipient (it is stored newest
 * first, so a naive read blames the wrong server), and the SPF/DKIM/DMARC plus
 * sender-alignment verdicts drive a named, reproducible risk score. If either
 * broke silently, the analyzer would confidently accuse the recipient's own MX
 * or clear a spoof.
 */
import { parseEmailHeaders } from "../../src/main/analyzers/email-header-parser";

// A spoofed message: display domain, envelope domain, and reply-to all differ,
// every authentication check fails, and three hops carry the message from the
// attacker's host through a foreign relay into the recipient's MX.
const spoofedHeaders = `Delivered-To: victim@recipient.com
Received: from mx.recipient.com (mx.recipient.com [198.51.100.20])
        by inbox.recipient.com with ESMTPS id abc123
        for <victim@recipient.com>; Fri, 15 Aug 2026 09:14:25 -0700 (PDT)
Received: from relay.sketchy-mailer.ru (relay.sketchy-mailer.ru [203.0.113.66])
        by mx.recipient.com with ESMTP id def456; Fri, 15 Aug 2026 09:14:20 -0700 (PDT)
Received: from evil-host.attacker.example (unknown [192.0.2.13])
        by relay.sketchy-mailer.ru with SMTP id ghi789; Fri, 15 Aug 2026 16:14:02 +0000 (UTC)
Authentication-Results: mx.recipient.com; spf=fail (sender IP is 192.0.2.13) smtp.mailfrom=sketchy-mailer.ru; dkim=fail header.d=paypa1-secure.com; dmarc=fail (p=REJECT) header.from=paypa1-secure.com
Received-SPF: fail (mx.recipient.com: domain of sketchy-mailer.ru does not designate 192.0.2.13 as permitted sender)
From: "PayPal Service" <service@paypa1-secure.com>
Return-Path: <bounce@sketchy-mailer.ru>
Reply-To: <phish@attacker.example>
Subject: Your account has been limited
Date: Fri, 15 Aug 2026 09:14:00 -0700
Message-ID: <a1b2c3@paypa1-secure.com>

This is the body and must be ignored by the header parser.`;

const legitimateHeaders = `Delivered-To: user@recipient.com
Received: from mail.example.com (mail.example.com [93.184.216.34])
        by mx.recipient.com with ESMTPS id xyz001; Fri, 15 Aug 2026 09:00:10 -0700 (PDT)
Authentication-Results: mx.recipient.com; spf=pass smtp.mailfrom=example.com; dkim=pass header.d=example.com; dmarc=pass header.from=example.com
DKIM-Signature: v=1; a=rsa-sha256; d=example.com; s=sel; h=from:subject;
From: "Example Support" <support@example.com>
Return-Path: <support@example.com>
Subject: Welcome aboard
Date: Fri, 15 Aug 2026 09:00:00 -0700
Message-ID: <hello@example.com>`;

it("reverses the Received chain so the earliest hop is the true origin, not the recipient MX", () => {
  const report = parseEmailHeaders(spoofedHeaders);

  expect(report.hops).toHaveLength(3);
  // Origin is the LAST Received in the file; a naive top-down read would blame
  // the recipient's own inbox server instead.
  expect(report.hops[0].fromHost).toBe("evil-host.attacker.example");
  expect(report.hops[0].ip).toBe("192.0.2.13");
  expect(report.hops[2].fromHost).toBe("mx.recipient.com");
  expect(report.originatingIp).toBe("192.0.2.13");
  expect(report.originatingHost).toBe("evil-host.attacker.example");
});

it("infers each hop's organization and the delay from the previous hop so transit is legible", () => {
  const report = parseEmailHeaders(spoofedHeaders);

  expect(report.hops[0].org).toBe("attacker.example");
  expect(report.hops[1].org).toBe("sketchy-mailer.ru");
  expect(report.hops[2].org).toBe("recipient.com");
  // The first hop has no predecessor, so it carries no delay.
  expect(report.hops[0].delaySeconds).toBeNull();
  // 16:14:20Z minus 16:14:02Z across the timezone boundary.
  expect(report.hops[1].delaySeconds).toBe(18);
  expect(report.hops[2].delaySeconds).toBe(5);
  expect(report.totalTransitSeconds).toBe(23);
});

it("reads SPF, DKIM, and DMARC verdicts from Authentication-Results", () => {
  const report = parseEmailHeaders(spoofedHeaders);

  expect(report.auth).toEqual({ spf: "fail", dkim: "fail", dmarc: "fail" });
});

it("flags every sender-address mismatch and authentication failure as a spoofing indicator", () => {
  const report = parseEmailHeaders(spoofedHeaders);

  expect(report.fromDomain).toBe("paypa1-secure.com");
  expect(report.returnPathDomain).toBe("sketchy-mailer.ru");
  expect(report.replyToDomain).toBe("attacker.example");
  const joined = report.spoofingIndicators.join(" | ");
  expect(joined).toContain("Return-Path");
  expect(joined).toContain("Reply-To");
  expect(report.spoofingIndicators.some((indicator) => indicator.includes("SPF"))).toBe(true);
  expect(report.spoofingIndicators.some((indicator) => indicator.includes("DKIM"))).toBe(true);
  expect(report.spoofingIndicators.some((indicator) => indicator.includes("DMARC"))).toBe(true);
});

it("scores a triple-fail spoof at maximum risk with each contributing reason named", () => {
  const report = parseEmailHeaders(spoofedHeaders);

  expect(report.riskScore).toBe(100);
  expect(report.riskReasons).toContain("DMARC failed");
  expect(report.riskReasons).toContain("SPF failed");
  expect(report.riskReasons).toContain("DKIM failed");
  expect(report.riskReasons.some((reason) => reason.includes("mismatch"))).toBe(true);
});

it("clears an aligned, fully authenticated message with a low score and no spoofing indicators", () => {
  const report = parseEmailHeaders(legitimateHeaders);

  expect(report.auth).toEqual({ spf: "pass", dkim: "pass", dmarc: "pass" });
  expect(report.fromDomain).toBe("example.com");
  expect(report.returnPathDomain).toBe("example.com");
  expect(report.spoofingIndicators).toEqual([]);
  expect(report.riskScore).toBe(0);
  expect(report.riskReasons).toEqual(["Authentication passed and sender addresses align"]);
});

it("treats absent authentication headers as unknown rather than crashing on sparse input", () => {
  const report = parseEmailHeaders("From: nobody@nowhere.test\nSubject: hi");

  expect(report.auth).toEqual({ spf: "none", dkim: "none", dmarc: "none" });
  expect(report.hops).toEqual([]);
  expect(report.originatingIp).toBeNull();
  // No hops parsed is itself worth surfacing as a reason.
  expect(report.riskReasons.some((reason) => reason.includes("No Received hops"))).toBe(true);
});
