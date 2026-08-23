/**
 * Dork generation is local template expansion because it should never contact a
 * search provider from Reacher. If generation opened network calls implicitly,
 * a passive query builder would become an untracked external action.
 */
import type { DorkResult } from "../../shared/schemas/analyzers.js";

const templates: readonly { readonly label: string; readonly query: string }[] = [
  { label: "Exposed documents", query: "site:{target} filetype:pdf OR filetype:xls OR filetype:xlsx OR filetype:doc OR filetype:docx OR filetype:ppt" },
  { label: "Login portals", query: "site:{target} intitle:login OR inurl:login OR inurl:signin OR inurl:admin" },
  { label: "Directory listings", query: "site:{target} intitle:\"index of\"" },
  { label: "Config files", query: "site:{target} ext:env OR ext:conf OR ext:ini OR ext:cfg OR ext:yaml OR ext:yml" },
  { label: "Public repos", query: "\"{target}\" site:github.com OR site:gitlab.com OR site:bitbucket.org" },
  { label: "Backup & archive files", query: "site:{target} ext:bak OR ext:old OR ext:backup OR ext:zip OR ext:tar OR ext:gz OR ext:rar" },
  { label: "Database dumps", query: "site:{target} ext:sql OR ext:db OR ext:sqlite OR ext:mdb OR \"phpMyAdmin\"" },
  { label: "Log files", query: "site:{target} ext:log OR filetype:log" },
  { label: "Exposed .git", query: "site:{target} inurl:.git OR intitle:\"index of\" \".git\"" },
  { label: "Environment secrets", query: "site:{target} ext:env \"DB_PASSWORD\" OR \"API_KEY\" OR \"SECRET\"" },
  { label: "Credentials in text", query: "site:{target} intext:password OR intext:passwd OR intext:credentials filetype:txt" },
  { label: "API keys & tokens", query: "site:{target} intext:\"api_key\" OR intext:\"apikey\" OR intext:\"access_token\"" },
  { label: "Admin & dashboards", query: "site:{target} inurl:admin OR inurl:dashboard OR inurl:cpanel OR intitle:\"control panel\"" },
  { label: "Error messages & stack traces", query: "site:{target} intext:\"sql syntax near\" OR intext:\"stack trace\" OR intext:\"fatal error\"" },
  { label: "Open redirects & params", query: "site:{target} inurl:redirect OR inurl:url= OR inurl:return= OR inurl:next=" },
  { label: "Upload & file managers", query: "site:{target} inurl:upload OR inurl:filemanager OR intitle:\"file upload\"" },
  { label: "Cloud storage exposure", query: "\"{target}\" site:s3.amazonaws.com OR site:blob.core.windows.net OR site:storage.googleapis.com" },
  { label: "Subdomains", query: "site:*.{target} -www" },
  { label: "Cached & wayback", query: "site:web.archive.org \"{target}\"" },
  { label: "Employee & email footprint", query: "\"{target}\" site:linkedin.com OR intext:\"@{target}\"" },
  { label: "Pastebin leaks", query: "\"{target}\" site:pastebin.com OR site:ghostbin.com OR site:paste.ee" },
  { label: "Exposed cameras & IoT", query: "site:{target} inurl:\"view/index.shtml\" OR intitle:\"webcamXP\" OR inurl:8080" }
];

export function buildDorks(target: string): DorkResult[] {
  return templates.map((template) => ({
    label: template.label,
    query: template.query.replaceAll("{target}", target)
  }));
}
