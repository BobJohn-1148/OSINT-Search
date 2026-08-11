/**
 * Dork generation is local template expansion because it should never contact a
 * search provider from Reacher. If generation opened network calls implicitly,
 * a passive query builder would become an untracked external action.
 */
import type { DorkResult } from "../../shared/schemas/analyzers.js";

const templates: readonly { readonly label: string; readonly query: string }[] = [
  { label: "Exposed documents", query: "site:{target} filetype:pdf OR filetype:xls OR filetype:doc" },
  { label: "Login portals", query: "site:{target} intitle:login OR inurl:login" },
  { label: "Directory listings", query: "site:{target} intitle:\"index of\"" },
  { label: "Config files", query: "site:{target} ext:env OR ext:conf OR ext:ini" },
  { label: "Public repos", query: "\"{target}\" site:github.com OR site:gitlab.com" }
];

export function buildDorks(target: string): DorkResult[] {
  return templates.map((template) => ({
    label: template.label,
    query: template.query.replaceAll("{target}", target)
  }));
}
