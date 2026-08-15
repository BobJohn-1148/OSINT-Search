/** Sherlock username connector — fixed argv, shell:false, parse --print-found stdout
 *  into observations; keep --csv as the case artifact. Passive. emit is batched
 *  by the orchestrator (see planning/STABILITY.md). */
import type { SourceConnector, Observation, Seed, RunContext } from "../shared/types";
import { launchInWsl } from "../main/tools/wsl-launcher";
const FOUND = /^\[\+\]\s+(.+?):\s+(https?:\/\/\S+)\s*$/;
export function sherlockArgv(u: string, distro = "kali-linux", out = "/tmp/reacher-sherlock"): string[] {
  return ["-d", distro, "--", "sherlock", u, "--print-found", "--timeout", "20", "--csv", "--folderoutput", out];
}
export const sherlockConnector: SourceConnector = {
  id: "sherlock", category: "username", tier: "passive", keyRequired: false,
  supports: (s: Seed) => s.type === "username",
  async run(seed, ctx: RunContext) {
    const found: Observation[] = [];
    await launchInWsl({ argv: sherlockArgv(seed.value, ctx.wslDistro, ctx.runTmpDir), onLine: (l: string) => {
      const m = FOUND.exec(l.trim()); if (!m) return; const [, site, url] = m;
      const o: Observation = { entity: url, type: "profile", value: url, source: `sherlock:${site}`, confidence: 1 };
      found.push(o); ctx.emit?.("search:observation", o);
    }});
    return found;
  },
};
