/**
 * Sherlock is the username spine of the fan-out: it is the one source that turns
 * a bare handle into a list of live profile URLs across hundreds of sites, which
 * is exactly the raw material the correlation merger needs to promote a handle
 * from single-source to corroborated.
 *
 * It is exported as a factory rather than a const connector because it needs the
 * WSL launcher and the configured distro, and the static connector registry has
 * no access to either — building it at the composition root keeps the registry a
 * plain list while still giving this connector its host dependencies.
 *
 * The username is its own argv element and the launcher is fixed to
 * `shell: false`, so a seed containing shell metacharacters is inert data rather
 * than a command. That is the same guarantee the tools launcher makes, and it
 * matters more here because search seeds are typed freely and never reviewed.
 */
import type { ObservationInput, SearchSeed, SeedType } from "../../../shared/types/search.js";
import type { WslToolLauncher } from "../../tools/wsl-launcher.js";
import type { SourceConnector, SourceRunContext } from "../source-connector.js";

const sourceId = "sherlock";
// Sherlock sweeps hundreds of sites at 20s each; the 60s default that suits an
// HTTP lookup would abort every run before it finished its first pass.
const SHERLOCK_TIMEOUT_MS = 180_000;
const FOUND_LINE = /^\[\+\]\s+(.+?):\s+(https?:\/\/\S+)\s*$/;
// Built rather than written as an escape, so no source file ever carries a raw
// NUL byte and greps stop treating this module as binary.
const NUL = String.fromCharCode(0);

export function sherlockArgv(username: string, outputDir: string): readonly string[] {
  return ["sherlock", username, "--print-found", "--timeout", "20", "--csv", "--folderoutput", outputDir];
}

export function createSherlockConnector(
  launcher: WslToolLauncher,
  resolveDistro: () => string
): SourceConnector {
  return {
    id: sourceId,
    label: "Sherlock",
    category: "identity",
    tier: "passive",
    keyRequired: false,
    timeoutMs: SHERLOCK_TIMEOUT_MS,
    supports(seedType: SeedType): boolean {
      return seedType === "username";
    },
    async run(seed: SearchSeed, context: SourceRunContext): Promise<readonly ObservationInput[]> {
      const username = seed.value.trim();
      if (!username) {
        return [];
      }
      const runId = `search:${sourceId}:${username}:${Date.now()}`;
      const outputDir = `/tmp/reacher-sherlock/${Date.now()}`;
      const observations: ObservationInput[] = [];
      // stdout arrives as byte chunks, not lines, so a profile URL can be split
      // across two callbacks. Buffering the tail avoids dropping that hit.
      let pending = "";

      const consume = (text: string): void => {
        pending += text;
        const lines = pending.split(/\r?\n/);
        pending = lines.pop() ?? "";
        for (const line of lines) {
          const observation = parseFoundLine(line, username);
          if (observation) {
            observations.push(observation);
          }
        }
      };

      const result = await launcher.run({
        runId,
        wslDistro: resolveDistro(),
        argv: sherlockArgv(username, outputDir),
        signal: context.signal,
        // The launcher's own constructor default (60s) is shared by every WSL
        // call unless overridden per-run -- without this, Sherlock's declared
        // SHERLOCK_TIMEOUT_MS above only bounded the orchestrator's outer
        // race, while the process itself still got killed at 60s regardless.
        timeoutMs: SHERLOCK_TIMEOUT_MS,
        onOutput: (event) => {
          if (event.stream === "stdout") {
            consume(event.chunk);
          }
        }
      });
      consume("\n");

      // Sherlock exits non-zero on partial failures even when it found real
      // profiles, so results win over exit code. Only a run that produced
      // nothing at all is reported as a failed source, which is what tells the
      // investigator the tool is missing rather than the handle being unused.
      if (observations.length === 0 && result.exitCode !== 0) {
        throw new Error(sherlockFailureMessage(result.stderr));
      }
      return observations;
    }
  };
}

function parseFoundLine(line: string, username: string): ObservationInput | null {
  const match = FOUND_LINE.exec(line.trim());
  if (!match) {
    return null;
  }
  const [, site, url] = match;
  return {
    entity: `username:${username}`,
    type: "profile",
    value: url,
    source: sourceId,
    // lookupUrl is what the node details panel opens, so the profile URL is
    // reachable in one click from the correlation tree.
    raw: { site, lookupUrl: url }
  };
}

function sherlockFailureMessage(rawStderr: string): string {
  // wsl.exe writes its OWN diagnostics ("...is not installed") as UTF-16LE
  // while the launcher decodes every stream as UTF-8, which leaves the text
  // NUL-interleaved and therefore invisible in the source list. Stripping NULs
  // here rather than changing the launcher's decoding keeps real tool output --
  // which genuinely is UTF-8 -- untouched for tools and scans.
  const stderr = rawStderr.split(NUL).join("");
  // wsl.exe puts its diagnosis on the FIRST line and a docs link on the last,
  // while the generic last-line fallback below is right for real tools (a
  // Python traceback ends with its exception). Naming the two cases that
  // actually block Jack keeps him from reading "visit aka.ms/wslinstall" and
  // having to work out what it means.
  if (/Subsystem for Linux (is|has) not (been )?installed|--install/i.test(stderr)) {
    return "WSL is not installed, so Sherlock cannot run. Install it with: wsl --install";
  }
  if (/no installed distributions|not a valid distribution|WslRegisterDistribution/i.test(stderr)) {
    return "The configured WSL distro was not found. Check Settings -> WSL distro, or install one with: wsl --install -d Ubuntu";
  }
  if (/command not found|No such file/i.test(stderr)) {
    return "Sherlock is not installed in the configured WSL distro. Install it with: pipx install sherlock-project";
  }
  const lastLine = stderr
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .at(-1);
  // Empty lines are already filtered out above, so undefined is the only
  // fallback case and ?? is exact here.
  return lastLine ?? "Sherlock returned no results";
}
