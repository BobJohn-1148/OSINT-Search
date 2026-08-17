/**
 * API diagnostics test source health without exposing secrets. Known endpoints
 * get bounded live probes; ambiguous paid APIs degrade to a vault/decrypt check
 * so Settings can still verify each stored key individually.
 */
import type { AuditRepository } from "../../db/repositories/audit-repository.js";
import type { VaultRepository } from "../../db/repositories/vault-repository.js";
import type { ApiDiagnosticResult } from "../../shared/schemas/api-diagnostics.js";
import { keySourceValues, type KeySource } from "../../shared/types/sources.js";

type ProbeKind = ApiDiagnosticResult["probe"];

interface ApiProbeDefinition {
  readonly source: KeySource;
  readonly label: string;
  readonly category: string;
  readonly requiresKey: boolean;
  readonly probe: ProbeKind;
  run?(input: { readonly secret: string | null; readonly signal: AbortSignal; readonly fetcher: typeof fetch }): Promise<void>;
}

const DEFAULT_TIMEOUT_MS = 12_000;

export class ApiDiagnosticsService {
  private readonly definitions: readonly ApiProbeDefinition[];

  public constructor(
    private readonly vaultRepository: VaultRepository,
    private readonly auditRepository: AuditRepository,
    private readonly fetcher: typeof fetch = fetch
  ) {
    this.definitions = buildDefinitions();
  }

  public list(): ApiDiagnosticResult[] {
    return this.definitions.map((definition) => this.untestedResult(definition));
  }

  public async test(sources?: readonly KeySource[]): Promise<ApiDiagnosticResult[]> {
    const requested = new Set(sources ?? keySourceValues);
    const definitions = this.definitions.filter((definition) => requested.has(definition.source));
    return Promise.all(definitions.map((definition) => this.testOne(definition)));
  }

  private async testOne(definition: ApiProbeDefinition): Promise<ApiDiagnosticResult> {
    const checkedTs = new Date().toISOString();
    const configured = definition.requiresKey ? this.vaultRepository.has(definition.source) : true;
    if (definition.requiresKey && !configured) {
      return {
        ...this.baseResult(definition, checkedTs, null),
        configured,
        status: "not-configured",
        message: `${definition.label} key is not stored`
      };
    }

    let secret: string | null = null;
    if (definition.requiresKey) {
      secret = this.vaultRepository.readSecret(definition.source, "local-user", "api.diagnostics");
    }

    const started = Date.now();
    try {
      if (definition.probe === "vault") {
        return {
          ...this.baseResult(definition, checkedTs, Date.now() - started),
          configured,
          status: "pass",
          message: `${definition.label} key decrypts; no live endpoint probe is configured yet`
        };
      }

      await this.runWithTimeout(definition, secret);
      return {
        ...this.baseResult(definition, checkedTs, Date.now() - started),
        configured,
        status: "pass",
        message: `${definition.label} responded to the ${definition.probe} health check`
      };
    } catch (error) {
      return {
        ...this.baseResult(definition, checkedTs, Date.now() - started),
        configured,
        status: "fail",
        message: sanitizeError(error)
      };
    } finally {
      this.auditRepository.record({
        actor: "local-user",
        action: "api.diagnostics",
        objectType: "api_source",
        objectId: definition.source,
        sensitivity: definition.requiresKey ? "sensitive" : "medium",
        detail: { source: definition.source, probe: definition.probe, configured }
      });
    }
  }

  private async runWithTimeout(definition: ApiProbeDefinition, secret: string | null): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error(`${definition.label} timed out`)), DEFAULT_TIMEOUT_MS);
    try {
      await definition.run?.({ secret, signal: controller.signal, fetcher: this.fetcher });
    } finally {
      clearTimeout(timeout);
    }
  }

  private untestedResult(definition: ApiProbeDefinition): ApiDiagnosticResult {
    const checkedTs = new Date().toISOString();
    return {
      ...this.baseResult(definition, checkedTs, null),
      configured: definition.requiresKey ? this.vaultRepository.has(definition.source) : true,
      status: "skipped",
      message: definition.probe === "vault" ? "Vault-only diagnostic available" : "Ready to test"
    };
  }

  private baseResult(definition: ApiProbeDefinition, checkedTs: string, latencyMs: number | null): Omit<ApiDiagnosticResult, "configured" | "status" | "message"> {
    return {
      source: definition.source,
      label: definition.label,
      category: definition.category,
      probe: definition.probe,
      requiresKey: definition.requiresKey,
      latencyMs,
      checkedTs
    };
  }
}

function buildDefinitions(): readonly ApiProbeDefinition[] {
  const definitions: Partial<Record<KeySource, ApiProbeDefinition>> = {
    openai: liveKey("openai", "OpenAI", "AI provider", ({ secret, signal, fetcher }) =>
      fetchJsonOk(fetcher, "https://api.openai.com/v1/models", { signal, headers: bearer(secret) })
    ),
    xai: liveKey("xai", "xAI Grok", "AI provider", ({ secret, signal, fetcher }) =>
      fetchJsonOk(fetcher, "https://api.x.ai/v1/models", { signal, headers: bearer(secret) })
    ),
    anthropic: liveKey("anthropic", "Anthropic", "AI provider", ({ secret, signal, fetcher }) =>
      fetchJsonOk(fetcher, "https://api.anthropic.com/v1/models", {
        signal,
        headers: { "x-api-key": secret ?? "", "anthropic-version": "2023-06-01" }
      })
    ),
    ollama: local("ollama", "Ollama", "Local AI", ({ signal, fetcher }) =>
      fetchJsonOk(fetcher, "http://127.0.0.1:11434/api/tags", { signal })
    ),
    "lm-studio": local("lm-studio", "LM Studio", "Local AI", ({ signal, fetcher }) =>
      fetchJsonOk(fetcher, "http://127.0.0.1:1234/v1/models", { signal })
    ),
    shodan: liveKey("shodan", "Shodan", "Internet intelligence", ({ secret, signal, fetcher }) =>
      fetchJsonOk(fetcher, `https://api.shodan.io/api-info?key=${encodeURIComponent(secret ?? "")}`, { signal })
    ),
    ipinfo: liveKey("ipinfo", "IPinfo", "IP intelligence", ({ secret, signal, fetcher }) =>
      fetchJsonOk(fetcher, `https://ipinfo.io/1.1.1.1/json?token=${encodeURIComponent(secret ?? "")}`, { signal })
    ),
    abuseipdb: liveKey("abuseipdb", "AbuseIPDB", "Threat intelligence", ({ secret, signal, fetcher }) =>
      fetchJsonOk(fetcher, "https://api.abuseipdb.com/api/v2/check?ipAddress=1.1.1.1&maxAgeInDays=90", {
        signal,
        headers: { Key: secret ?? "", Accept: "application/json" }
      })
    ),
    greynoise: liveKey("greynoise", "GreyNoise", "Threat intelligence", ({ secret, signal, fetcher }) =>
      fetchJsonOk(fetcher, "https://api.greynoise.io/v3/community/1.1.1.1", {
        signal,
        headers: { key: secret ?? "", Accept: "application/json" }
      })
    ),
    hunter: liveKey("hunter", "Hunter", "Email intelligence", ({ secret, signal, fetcher }) =>
      fetchJsonOk(fetcher, `https://api.hunter.io/v2/account?api_key=${encodeURIComponent(secret ?? "")}`, { signal })
    ),
    leakcheck: liveKey("leakcheck", "LeakCheck", "Breach monitoring", ({ secret, signal, fetcher }) =>
      fetchJsonOk(fetcher, "https://leakcheck.io/api/v2/whoami", {
        signal,
        headers: { "X-API-Key": secret ?? "", Accept: "application/json" }
      })
    ),
    virustotal: liveKey("virustotal", "VirusTotal", "Threat intelligence", ({ secret, signal, fetcher }) =>
      fetchJsonOk(fetcher, "https://www.virustotal.com/api/v3/users/current", {
        signal,
        headers: { "x-apikey": secret ?? "", Accept: "application/json" }
      })
    ),
    urlscan: liveKey("urlscan", "urlscan.io", "URL intelligence", ({ secret, signal, fetcher }) =>
      fetchJsonOk(fetcher, "https://urlscan.io/user/quotas/", {
        signal,
        headers: { "API-Key": secret ?? "", Accept: "application/json" }
      })
    ),
    otx: liveKey("otx", "AlienVault OTX", "Threat intelligence", ({ secret, signal, fetcher }) =>
      fetchJsonOk(fetcher, "https://otx.alienvault.com/api/v1/user/me", {
        signal,
        headers: { "X-OTX-API-KEY": secret ?? "", Accept: "application/json" }
      })
    ),
    nvd: liveOptionalKey("nvd", "NVD", "Vulnerability data", ({ secret, signal, fetcher }) =>
      fetchJsonOk(fetcher, "https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=openssl&resultsPerPage=1", {
        signal,
        headers: secret ? { apiKey: secret } : undefined
      })
    ),
    xposedornot: liveOptionalKey("xposedornot", "XposedOrNot", "Breach monitoring", ({ signal, fetcher }) =>
      fetchJsonOk(fetcher, "https://api.xposedornot.com/v1/check-email/test@example.com", { signal }, [200, 404])
    ),
    "abuse-ch": liveOptionalKey("abuse-ch", "abuse.ch URLhaus", "Threat intelligence", ({ signal, fetcher }) =>
      fetchJsonOk(fetcher, "https://urlhaus-api.abuse.ch/v1/urls/recent/", { signal })
    )
  };

  return keySourceValues.map((source) => definitions[source] ?? vaultOnly(source, sourceLabel(source), categoryForSource(source)));
}

function liveKey(
  source: KeySource,
  label: string,
  category: string,
  run: NonNullable<ApiProbeDefinition["run"]>
): ApiProbeDefinition {
  return { source, label, category, requiresKey: true, probe: "live", run };
}

function liveOptionalKey(
  source: KeySource,
  label: string,
  category: string,
  run: NonNullable<ApiProbeDefinition["run"]>
): ApiProbeDefinition {
  return { source, label, category, requiresKey: false, probe: "live", run };
}

function local(
  source: KeySource,
  label: string,
  category: string,
  run: NonNullable<ApiProbeDefinition["run"]>
): ApiProbeDefinition {
  return { source, label, category, requiresKey: false, probe: "local", run };
}

function vaultOnly(source: KeySource, label: string, category: string): ApiProbeDefinition {
  return { source, label, category, requiresKey: true, probe: "vault" };
}

async function fetchJsonOk(fetcher: typeof fetch, url: string, init?: RequestInit, okStatuses: readonly number[] = [200]): Promise<void> {
  const response = await fetcher(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "User-Agent": "Reacher local OSINT app",
      ...Object.fromEntries(new Headers(init?.headers))
    }
  });
  if (!okStatuses.includes(response.status)) {
    throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);
  }
}

function bearer(secret: string | null): Record<string, string> {
  return { Authorization: `Bearer ${secret ?? ""}` };
}

function sourceLabel(source: KeySource): string {
  return source
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function categoryForSource(source: KeySource): string {
  if (["openai", "xai", "anthropic", "ollama", "lm-studio"].includes(source)) {
    return "AI provider";
  }
  if (["hibp", "leakcheck", "dehashed", "snusbase", "intelx", "xposedornot"].includes(source)) {
    return "Breach monitoring";
  }
  if (["shodan", "censys", "greynoise", "virustotal", "otx", "urlscan", "abuse-ch"].includes(source)) {
    return "Threat intelligence";
  }
  if (["hunter", "emailrep"].includes(source)) {
    return "Email intelligence";
  }
  if (["numverify", "twilio"].includes(source)) {
    return "Phone intelligence";
  }
  if (["opencorporates", "companies-house"].includes(source)) {
    return "Business records";
  }
  return "OSINT source";
}

function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "API diagnostic failed";
  return message
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-[redacted]")
    .replace(/xai-[A-Za-z0-9_-]+/g, "xai-[redacted]")
    .replace(/sk-ant-[A-Za-z0-9_-]+/g, "sk-ant-[redacted]");
}
