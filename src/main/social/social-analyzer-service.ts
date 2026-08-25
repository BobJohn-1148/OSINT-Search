/**
 * SocialAnalyzerService produces public-profile candidates from an offline
 * WhatsMyName-derived catalog, then optionally verifies them for real. If this
 * service marked candidates as hits from the template alone, Reacher would
 * fabricate OSINT evidence before an actual HTTP check confirmed the profile.
 *
 * Verification is a separate pass (verify()), not folded into analyze(),
 * because checking ~300+ live sites per username is a real network operation
 * with a real cost and a real signal to those sites -- it must be something
 * an investigator explicitly asks for, not something that runs on every
 * keystroke. Fan-out is bounded to a fixed concurrency so a verify pass
 * throttles instead of flooding the network or the event loop, matching the
 * app's stability invariant against unbounded fan-out.
 */
import type { SocialAnalyzeRequest, SocialAnalyzeResponse, SocialCandidateStatus, SocialVerifyRequest, SocialVerifyResponse } from "../../shared/schemas/social.js";
import type { AuditRepository } from "../../db/repositories/audit-repository.js";
import { generatedSocialNetworks, type SocialNetworkTemplate } from "./social-network-catalog.generated.js";

const DEFAULT_CONCURRENCY = 12;
const DEFAULT_TIMEOUT_MS = 6000;

export interface SocialProbeResult {
  readonly status: number;
  readonly body: string;
}

export type SocialProbe = (url: string, timeoutMs: number) => Promise<SocialProbeResult | null>;

export class SocialAnalyzerService {
  private readonly networksByName = new Map<string, SocialNetworkTemplate>(generatedSocialNetworks.map((network) => [network.name, network]));

  public constructor(
    private readonly auditRepository?: AuditRepository,
    private readonly probe: SocialProbe = defaultProbe,
    private readonly concurrency: number = DEFAULT_CONCURRENCY,
    private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS
  ) {}

  public analyze(request: SocialAnalyzeRequest): SocialAnalyzeResponse {
    const username = encodeURIComponent(request.username.trim());
    const candidates = generatedSocialNetworks.slice(0, request.limit).map((network) => ({
      network: network.name,
      url: network.uri.replaceAll("{account}", username),
      fields: ["profile" as const, "relationships" as const, "images" as const],
      status: "candidate" as const
    }));

    return {
      username: request.username.trim(),
      totalNetworks: generatedSocialNetworks.length,
      candidates,
      recommendedTools: ["maigret-social", "whatsmyname", "sherlock", "blackbird"]
    };
  }

  public async verify(request: SocialVerifyRequest): Promise<SocialVerifyResponse> {
    const analysis = this.analyze(request);
    let checkedCount = 0;
    let skippedCount = 0;

    const results = await runWithConcurrency(analysis.candidates, this.concurrency, async (candidate) => {
      const network = this.networksByName.get(candidate.network);
      if (!network || network.protected) {
        skippedCount += 1;
        return { ...candidate, status: "unknown" as const };
      }
      checkedCount += 1;
      const probeResult = await this.probe(candidate.url, this.timeoutMs);
      return { ...candidate, status: classify(network, probeResult) };
    });

    this.auditRepository?.record({
      actor: "local-user",
      action: "social.verify",
      objectType: "social_verify",
      objectId: null,
      sensitivity: "medium",
      detail: {
        username: analysis.username,
        checkedCount,
        skippedCount,
        verifiedCount: results.filter((candidate) => candidate.status === "verified").length,
        absentCount: results.filter((candidate) => candidate.status === "absent").length
      }
    });

    return { username: analysis.username, candidates: results, checkedCount, skippedCount };
  }
}

function classify(network: SocialNetworkTemplate, probeResult: SocialProbeResult | null): SocialCandidateStatus {
  if (!probeResult) {
    return "unknown";
  }
  if (probeResult.status === network.existsStatus && (network.existsString === "" || probeResult.body.includes(network.existsString))) {
    return "verified";
  }
  if (probeResult.status === network.missingStatus && (network.missingString === "" || probeResult.body.includes(network.missingString))) {
    return "absent";
  }
  return "unknown";
}

async function runWithConcurrency<T, R>(items: readonly T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runNext(): Promise<void> {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) {
        return;
      }
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runNext));
  return results;
}

async function defaultProbe(url: string, timeoutMs: number): Promise<SocialProbeResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; ReacherOSINT/1.0)" }
    });
    const body = await response.text();
    return { status: response.status, body };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
