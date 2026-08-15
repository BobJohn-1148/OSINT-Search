/** Holehe email connector — passive reset-probe across 120+ sites; fixed argv,
 *  shell:false; parse `[+] site` lines. emit batched (planning/STABILITY.md). */
import type { SourceConnector, Observation, Seed, RunContext } from "../shared/types";
import { launchInWsl } from "../main/tools/wsl-launcher";
const USED = /^\[\+\]\s+(\S+)/;
export function holeheArgv(email: string, distro = "kali-linux"): string[] {
  return ["-d", distro, "--", "holehe", "--only-used", "--no-color", email];
}
export const holeheConnector: SourceConnector = {
  id: "holehe", category: "email", tier: "passive", keyRequired: false,
  supports: (s: Seed) => s.type === "email",
  async run(seed, ctx: RunContext) {
    const found: Observation[] = [];
    await launchInWsl({ argv: holeheArgv(seed.value, ctx.wslDistro), onLine: (l: string) => {
      const m = USED.exec(l.trim()); if (!m) return; const site = m[1];
      const o: Observation = { entity: site, type: "account", value: `${seed.value} registered on ${site}`, source: `holehe:${site}`, confidence: 1 };
      found.push(o); ctx.emit?.("search:observation", o);
    }});
    return found;
  },
};
