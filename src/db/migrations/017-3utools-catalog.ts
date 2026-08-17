/**
 * 3uTools is a Windows GUI companion, not a WSL CLI scanner. This migration
 * adds it to existing local catalogs as a passive mobile reference/launcher so
 * users can open the installed desktop app from Tools without pretending its
 * risky flashing/jailbreak workflows are Reacher collectors.
 */
import type { ReacherDatabase } from "../database.js";

export const migration017ThreeUToolsCatalog = {
  id: 17,
  name: "3utools-catalog",
  up(db: ReacherDatabase): void {
    db.prepare(
      `INSERT OR IGNORE INTO tool_catalog
       (id, name, description, install_command, official_link, category, tier, default_args_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      "3utools",
      "3uTools",
      "Windows iPhone management companion. Reacher opens the GUI when installed; collection and reporting stay in the Mobile page.",
      "Download and install from https://www.3u.com/",
      "https://www.3u.com/",
      "mobile",
      "passive",
      JSON.stringify(["3uTools.exe"])
    );
  }
} as const;
