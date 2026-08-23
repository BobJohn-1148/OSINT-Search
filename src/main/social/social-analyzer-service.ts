/**
 * SocialAnalyzerService produces public-profile candidates from an offline
 * WhatsMyName-derived catalog. If this service marked candidates as hits, Reacher
 * would fabricate OSINT evidence before a cited checker such as Maigret or
 * Sherlock confirmed the profile.
 */
import type { SocialAnalyzeRequest, SocialAnalyzeResponse } from "../../shared/schemas/social.js";
import { generatedSocialNetworks } from "./social-network-catalog.generated.js";

export class SocialAnalyzerService {
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
}
