/** ignorant phone connector — passive registered-on checks; needs country code +
 *  national number (from the Phase 2 libphonenumber normaliser; naive split
 *  fallback). Fixed argv, shell:false; parse `[+] site`. emit batched. */
import type { SourceConnector, Observation, Seed, RunContext } from "../shared/types";
import { launchInWsl } from "../main/tools/wsl-launcher";
const USED = /^\[\+\]\s+(\S+)/;
function parts(s: Seed) {
  if (s.countryCode && s.national) return { cc: s.countryCode, national: s.national };
  const d = s.value.replace(/\D/g, "");
  return { cc: d.length > 10 ? d.slice(0, d.length - 10) : "1", national: d.slice(-10) };
}
export function ignorantArgv(s: Seed, distro = "kali-linux"): string[] {
  const { cc, national } = parts(s); return ["-d", distro, "--", "ignorant", "--no-color", cc, national];
}
export const ignorantConnector: SourceConnector = {
  id: "ignorant", category: "phone", tier: "passive", keyRequired: false,
  supports: (s: Seed) => s.type === "phone",
  async run(seed, ctx: RunContext) {
    const found: Observation[] = [];
    await launchInWsl({ argv: ignorantArgv(seed, ctx.wslDistro), onLine: (l: string) => {
      const m = USED.exec(l.trim()); if (!m) return; const site = m[1];
      const o: Observation = { entity: site, type: "account", value: `${seed.value} registered on ${site}`, source: `ignorant:${site}`, confidence: 1 };
      found.push(o); ctx.emit?.("search:observation", o);
    }});
    return found;
  },
};
