/**
 * Image and username depth tests use real SQLite with fake browser, WSL, and
 * agent adapters so correlation persistence is exercised without opening a
 * browser or running OSINT tools on the developer machine.
 */
import Database from "better-sqlite3";
import { runMigrations } from "../../src/db/migrations/runner";
import { AgentRuntimeRepository } from "../../src/db/repositories/agent-runtime-repository";
import { AgentsRepository } from "../../src/db/repositories/agents-repository";
import { AuditRepository } from "../../src/db/repositories/audit-repository";
import { CasesRepository } from "../../src/db/repositories/cases-repository";
import { ImageSearchRepository } from "../../src/db/repositories/image-search-repository";
import { SearchRepository } from "../../src/db/repositories/search-repository";
import type { VaultRepository } from "../../src/db/repositories/vault-repository";
import { AgentRuntimeService } from "../../src/main/agents/agent-runtime-service";
import { ImageUsernameService, type BrowserImageSearchResult } from "../../src/main/image-username/image-username-service";
import type { WslRunResult } from "../../src/main/tools/wsl-launcher";

function createHarness(browserSearch: (() => Promise<BrowserImageSearchResult>) | null = () =>
  Promise.resolve({
    matches: [
      {
        title: "Matching profile photo",
        url: "https://example.com/profile",
        source: "browser-google-lens"
      }
    ],
    launches: []
  })) {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  const auditRepository = new AuditRepository(db);
  const casesRepository = new CasesRepository(db);
  const searchRepository = new SearchRepository(db);
  const imageSearchRepository = new ImageSearchRepository(db);
  const launcherCalls: readonly string[][] = [];
  const launcher = {
    run: (input: { readonly argv: readonly string[] }): Promise<WslRunResult> => {
      (launcherCalls as string[][]).push([...input.argv]);
      const source = input.argv[0] === "maigret" ? "maigret" : "blackbird";
      return Promise.resolve({
        stdout: JSON.stringify([{ site: "GitHub", url: `https://github.com/jdoe`, status: "found", source }]),
        stderr: "",
        exitCode: 0
      });
    }
  };
  const readSecret = vi.fn();
  const vault = {
    has: vi.fn().mockReturnValue(false),
    readSecret
  } as unknown as VaultRepository;
  const agentRuntimeService = new AgentRuntimeService(
    new AgentsRepository(db),
    new AgentRuntimeRepository(db),
    casesRepository,
    auditRepository,
    () => undefined,
    process.cwd(),
    () => new Date("2026-08-10T12:00:00.000Z")
  );
  const service = new ImageUsernameService(
    imageSearchRepository,
    searchRepository,
    casesRepository,
    auditRepository,
    vault,
    launcher,
    agentRuntimeService,
    browserSearch ?? undefined,
    vi.fn(),
    () => new Date("2026-08-10T12:00:00.000Z")
  );
  return { casesRepository, db, imageSearchRepository, launcherCalls, readSecret, service };
}

it("adds image results as observations so an uploaded image becomes tree and case evidence", async () => {
  const harness = createHarness();
  const caseRecord = harness.casesRepository.create("Image case", []);

  const result = await harness.service.searchImage({ imagePath: "C:\\images\\subject.png", caseId: caseRecord.id });

  expect(result.usedBrowserFallback).toBe(true);
  expect(result.records).toEqual([
    expect.objectContaining({
      path: "C:\\images\\subject.png",
      source: "browser-google-lens",
      resultRef: "https://example.com/profile"
    })
  ]);
  expect(result.run.seed).toEqual({ type: "image", value: "C:\\images\\subject.png" });
  expect(result.run.observations[0]).toEqual(expect.objectContaining({ source: "browser-google-lens", value: "Matching profile photo" }));
  expect(harness.casesRepository.timeline(caseRecord.id)[0]?.title).toBe("Matching profile photo");
});

it("with no image API key the browser path is used without crashing so reverse image remains available", async () => {
  const harness = createHarness(() =>
    Promise.resolve({
      matches: [],
      launches: [
        { source: "browser-google-lens", url: "https://lens.google.com/search" },
        { source: "browser-yandex", url: "https://yandex.com/images/search" }
      ]
    })
  );

  const result = await harness.service.searchImage({ imagePath: "C:\\images\\subject.png" });

  expect(result.usedBrowserFallback).toBe(true);
  expect(harness.readSecret).not.toHaveBeenCalled();
  expect(result.browserLaunches.map((launch) => launch.url)).toEqual([
    "https://lens.google.com/search",
    "https://yandex.com/images/search"
  ]);
  expect(result.run.observations).toEqual([]);
  expect(result.savedItems).toBe(0);
});

it("username sweep corroborates the same account across sources so depth results get a stronger entity", async () => {
  const harness = createHarness();
  const caseRecord = harness.casesRepository.create("Username case", []);

  const result = await harness.service.usernameSweep({
    username: "jdoe",
    wslDistro: "Ubuntu",
    caseId: caseRecord.id,
    sendToAgent: false
  });

  expect(harness.launcherCalls).toEqual([
    ["maigret", "jdoe", "--json", "-"],
    ["blackbird", "-u", "jdoe", "--json"]
  ]);
  expect(result.run.entities[0]).toEqual(expect.objectContaining({
    entity: "https://github.com/jdoe",
    strength: 2,
    band: "likely"
  }));
  expect(result.savedItems).toBe(2);
});
