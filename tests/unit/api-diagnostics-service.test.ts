import { ApiDiagnosticsService } from "../../src/main/diagnostics/api-diagnostics-service";
import { keySourceValues, type KeySource } from "../../src/shared/types/sources";

function createService(options: {
  readonly stored?: Partial<Record<KeySource, string>>;
  readonly fetcher?: typeof fetch;
}) {
  const stored = options.stored ?? {};
  const reads: string[] = [];
  const auditEvents: unknown[] = [];
  const vaultRepository = {
    has: (source: KeySource) => stored[source] !== undefined,
    readSecret: (source: KeySource) => {
      reads.push(source);
      const secret = stored[source];
      if (secret === undefined) {
        throw new Error(`No API key is stored for ${source}`);
      }
      return secret;
    }
  };
  const auditRepository = {
    record: (event: unknown) => auditEvents.push(event)
  };
  return {
    service: new ApiDiagnosticsService(vaultRepository as never, auditRepository as never, options.fetcher ?? vi.fn()),
    reads,
    auditEvents
  };
}

it("lists every configured key source as an individually testable API", () => {
  const { service } = createService({});

  expect(service.list().map((entry) => entry.source).sort()).toEqual([...keySourceValues].sort());
});

it("reports a missing required key without making a live request", async () => {
  const fetcher = vi.fn<typeof fetch>();
  const { service, reads } = createService({ fetcher });

  const [result] = await service.test(["openai"]);

  expect(result).toMatchObject({
    source: "openai",
    status: "not-configured",
    configured: false
  });
  expect(fetcher).not.toHaveBeenCalled();
  expect(reads).toEqual([]);
});

it("runs a live probe with the stored secret without returning the secret", async () => {
  const fetcher = vi.fn<typeof fetch>(() => Promise.resolve(new Response("{}", { status: 200 })));
  const { service, reads } = createService({ stored: { openai: "sk-test-secret" }, fetcher });

  const [result] = await service.test(["openai"]);

  expect(result).toMatchObject({
    source: "openai",
    status: "pass",
    configured: true,
    probe: "live"
  });
  expect(result.message).not.toContain("sk-test-secret");
  expect(reads).toEqual(["openai"]);
  const [url, init] = fetcher.mock.calls[0] ?? [];
  expect(url).toBe("https://api.openai.com/v1/models");
  expect(new Headers(init?.headers).get("authorization")).toBe("Bearer sk-test-secret");
});

it("uses a vault-only diagnostic for APIs without a known safe endpoint probe", async () => {
  const fetcher = vi.fn<typeof fetch>();
  const { service } = createService({ stored: { censys: "id:secret" }, fetcher });

  const [result] = await service.test(["censys"]);

  expect(result).toMatchObject({
    source: "censys",
    status: "pass",
    probe: "vault",
    message: "Censys key decrypts; no live endpoint probe is configured yet"
  });
  expect(fetcher).not.toHaveBeenCalled();
});
