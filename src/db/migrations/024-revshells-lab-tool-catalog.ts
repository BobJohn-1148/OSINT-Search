/**
 * RevShells is useful as a CTF/lab reference, but generated reverse-shell
 * payloads are too easy to misuse if embedded as an automated launcher. Reacher
 * catalogs it as a reference-only lab tool and does not generate or execute
 * payloads on the user's behalf.
 *
 * Ported from the Codex branch (was migration 019 there) and renumbered to 024
 * for this canonical copy.
 */
import type { ReacherDatabase } from "../database.js";

export const migration024RevShellsLabToolCatalog = {
  id: 24,
  name: "revshells-lab-tool-catalog",
  up(db: ReacherDatabase): void {
    db.prepare(
      `INSERT OR IGNORE INTO tool_catalog
       (id, name, description, install_command, official_link, category, tier, default_args_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      "revshells",
      "RevShells",
      "Reference-only reverse shell and listener generator for owned labs, CTFs, and authorized exercises. Reacher links to the site but does not generate or launch payloads.",
      "Open https://www.revshells.com/ for authorized lab or CTF use only.",
      "https://www.revshells.com/",
      "lab",
      "passive",
      JSON.stringify(["echo", "Open https://www.revshells.com/ for authorized lab or CTF use only."])
    );
  }
} as const;
