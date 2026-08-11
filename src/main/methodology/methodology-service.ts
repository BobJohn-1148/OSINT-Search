/**
 * MethodologyService is static reference data because the map should guide an
 * engagement without launching tools by itself. If it executed commands, opening
 * a checklist would become an active operation outside the authorization gate.
 */
import type { MethodologyExportResponse, MethodologyListResponse, MethodologyPhase } from "../../shared/schemas/methodology.js";

const phases: readonly MethodologyPhase[] = [
  {
    id: "reconnaissance",
    title: "Reconnaissance",
    summary: "Gather public context, identities, domains, and first-pass assets.",
    frameworkRefs: ["OWASP WSTG-INFO", "PTES intelligence gathering", "OSSTMM visibility"],
    tools: [
      tool("osint-search", "OSINT search", "Search", "search:run", "Seed", "Correlated observations", "passive", false),
      tool("dorks", "Dork generator", "Analyzers", "analyzer:dork:build", "Target", "Query set", "passive", false),
      tool("subfinder", "subfinder", "Tools", "subfinder -d <domain>", "Domain", "Subdomains", "passive", false),
      tool("theharvester", "theHarvester", "Tools", "theHarvester -d <domain>", "Domain", "Emails and hosts", "passive", false)
    ]
  },
  {
    id: "scanning-enumeration",
    title: "Scanning and enumeration",
    summary: "Inventory reachable systems and fingerprint exposed services.",
    frameworkRefs: ["OWASP WSTG-CONF", "PTES vulnerability analysis", "OSSTMM access"],
    tools: [
      tool("nmap", "nmap scan", "Network scan", "nmap -oX - <target>", "Authorized target", "Hosts and ports", "active", true),
      tool("httpx", "httpx", "Tools", "httpx -u <url>", "Authorized URL", "HTTP fingerprints", "active", true),
      tool("whatweb", "WhatWeb", "Tools", "whatweb <url>", "Authorized URL", "Web technologies", "active", true),
      tool("subnet", "Subnet calculator", "Search", "offline CIDR calculation", "CIDR", "Ranges and host counts", "passive", false)
    ]
  },
  {
    id: "vulnerability-analysis",
    title: "Vulnerability analysis",
    summary: "Map discovered software and configuration to known weaknesses.",
    frameworkRefs: ["OWASP WSTG-ERRH", "PTES vulnerability analysis", "OSSTMM trust analysis"],
    tools: [
      tool("nvd", "NVD lookup", "Analyzers", "analyzer:vuln:lookup", "Product and version", "CVE list", "passive", false),
      tool("nuclei", "nuclei", "Tools", "nuclei -u <url>", "Authorized URL", "Template findings", "active", true),
      tool("wafw00f", "wafw00f", "Tools", "wafw00f <url>", "Authorized URL", "WAF fingerprint", "active", true),
      tool("headers", "Security headers", "Search", "HTTP header review", "URL", "Header findings", "passive", false)
    ]
  },
  {
    id: "exploitation-readiness",
    title: "Exploitation readiness",
    summary: "Confirm authorization and document safe, lab-scoped validation paths.",
    frameworkRefs: ["OWASP WSTG authorization", "PTES exploitation", "OSSTMM control verification"],
    tools: [
      tool("authorization", "Authorization records", "Tools", "auth:create", "Exact target and expiry", "Launch permission", "reference", true),
      tool("metasploit", "Metasploit catalog entry", "Tools", "msfconsole -q", "Authorized lab target", "Framework launch", "active", true),
      tool("sqlmap", "sqlmap catalog entry", "Tools", "sqlmap -u <url>", "Authorized URL", "SQLi validation output", "active", true),
      tool("practice-labs", "Practice targets", "Tools", "docker run lab image", "Local lab", "Legal target", "reference", false)
    ]
  },
  {
    id: "post-exploitation-analysis",
    title: "Post-exploitation analysis",
    summary: "Analyze local artifacts, hashes, captures, and memory images.",
    frameworkRefs: ["PTES post exploitation", "OSSTMM process", "OWASP evidence handling"],
    tools: [
      tool("hashcat", "hashcat", "Tools", "hashcat <hash-file>", "User-supplied hashes", "Local cracking status", "passive", false),
      tool("volatility3", "Volatility 3", "Tools", "vol <memory-image>", "Memory image", "Forensic findings", "passive", false),
      tool("pcap", "PCAP analyzer", "Analyzers", "analyzer:pcap:import", "Capture file", "Conversations", "passive", false),
      tool("evtx", "Event log analyzer", "Analyzers", "analyzer:evtx:import", "EVTX file", "Event findings", "passive", false)
    ]
  },
  {
    id: "reporting",
    title: "Reporting",
    summary: "Turn cited evidence, findings, and coverage into deliverables.",
    frameworkRefs: ["OWASP reporting", "PTES reporting", "OSSTMM metrics"],
    tools: [
      tool("cases", "Case timeline", "Cases", "case:timeline", "Case", "Evidence chronology", "passive", false),
      tool("reports", "Reports", "Reports", "report:generate", "Case or scan", "PDF or Word report", "passive", false),
      tool("audit", "Audit log", "Audit log", "audit:query", "Filters", "Append-only history", "passive", false),
      tool("coverage", "Coverage export", "Methodology", "methodology:export", "Matrix", "CSV spreadsheet", "passive", false)
    ]
  }
] as const;

export class MethodologyService {
  public list(): MethodologyListResponse {
    return { phases: [...phases] };
  }

  public exportCsv(): MethodologyExportResponse {
    const rows = [
      ["phase", "framework_refs", "tool", "surface", "command", "input", "output", "tier", "authorization_required"],
      ...phases.flatMap((phase) =>
        phase.tools.map((entry) => [
          phase.title,
          phase.frameworkRefs.join("; "),
          entry.label,
          entry.surface,
          entry.command,
          entry.input,
          entry.output,
          entry.tier,
          String(entry.authorizationRequired)
        ])
      )
    ];
    return {
      filename: "reacher-methodology-coverage.csv",
      csv: rows.map((row) => row.map(escapeCsv).join(",")).join("\n")
    };
  }
}

function tool(
  id: string,
  label: string,
  surface: string,
  command: string,
  input: string,
  output: string,
  tier: MethodologyPhase["tools"][number]["tier"],
  authorizationRequired: boolean
): MethodologyPhase["tools"][number] {
  return { id, label, surface, command, input, output, tier, authorizationRequired };
}

function escapeCsv(value: string): string {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}
