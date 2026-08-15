# Pentest methodology map

An interactive flowchart of pentest methodology based on OWASP (WSTG), PTES, and
OSSTMM. Six phase cards; each lists the Reacher tools you'd use and clicking a
tool opens it. Read-only reference + launchpad. Same dark theme.

1. Reconnaissance — OSINT search, dork generator, DNS/whois/CT search, subdomain
   enum (Sherlock/theHarvester), header + get-page-links.
2. Scanning & enumeration — nmap scan, HTTP headers, web tech fingerprint,
   TLS/SSL analyzer, subnet calculator, reverse IP.
3. Vulnerability analysis — vulnerability lookup (NVD), Shodan host analyzer,
   CORS / security-header checks.
4. Exploitation — reverse shell generator, msfvenom builder, shellcode encoder,
   callback catcher (all authorization-gated).
5. Post-exploitation — encoder/decoder + pipeline, hash tools, artifact analyzers
   (registry / execution / memory), attack chain builder.
6. Reporting — findings documenter, reports (PDF/Word), case export.

Render as connected phase cards with the OWASP/PTES/OSSTMM references; each tool
chip links into its surface.

## Interactivity + export
- Click a phase to drill into its tools; click a tool to open a detail panel:
  which Reacher surface/module it lives in, the exact command/example, input ->
  output, the OWASP/PTES/OSSTMM references, and whether it is authorization-gated.
- An "Export coverage spreadsheet" action prints a detailed spreadsheet (XLSX +
  CSV) of the full matrix: phase, framework refs, tool, surface/file, command,
  input, output, tier/authorization, and — when run inside a case — status +
  findings. Saves to the case and Reports, turning the map into an engagement
  checklist and coverage report.
