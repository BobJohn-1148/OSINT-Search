/**
 * Per-phase learning resources live in the renderer as curated links rather than
 * in the methodology service, because they are reference material for the human
 * — guides, videos, and free recon utilities — not evidence the main process
 * needs to audit. Keying by a phase category (matched from the title) keeps them
 * attached to the right phase without coupling to exact phase ids.
 */
export interface MethodologyResource {
  readonly label: string;
  readonly url: string;
}

export interface PhaseResources {
  readonly guides: readonly MethodologyResource[];
  readonly videos: readonly MethodologyResource[];
  readonly tools: readonly MethodologyResource[];
}

type PhaseCategory = "recon" | "scanning" | "vulnerability" | "exploitation" | "post" | "reporting" | "general";

function categorize(title: string): PhaseCategory {
  const text = title.toLowerCase();
  if (text.includes("recon") || text.includes("intel") || text.includes("osint") || text.includes("footprint")) {
    return "recon";
  }
  if (text.includes("scan") || text.includes("enumerat") || text.includes("discovery")) {
    return "scanning";
  }
  if (text.includes("vuln") || text.includes("analysis") || text.includes("assess")) {
    return "vulnerability";
  }
  if (text.includes("exploit") || text.includes("gaining") || text.includes("access")) {
    return "exploitation";
  }
  if (text.includes("post") || text.includes("privilege") || text.includes("persist") || text.includes("lateral")) {
    return "post";
  }
  if (text.includes("report") || text.includes("document")) {
    return "reporting";
  }
  return "general";
}

const yt = (query: string): string => `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

const RESOURCES: Record<PhaseCategory, PhaseResources> = {
  recon: {
    guides: [
      { label: "OWASP WSTG — Information Gathering", url: "https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/01-Information_Gathering/" },
      { label: "HackTricks — External Recon", url: "https://book.hacktricks.xyz/generic-methodologies-and-resources/external-recon-methodology" },
      { label: "OSINT Framework", url: "https://osintframework.com/" }
    ],
    videos: [
      { label: "OSINT reconnaissance walkthrough", url: yt("osint reconnaissance tutorial") },
      { label: "Passive recon for pentesters", url: yt("passive reconnaissance pentest tutorial") }
    ],
    tools: [
      { label: "Fake Name Generator (sock puppets)", url: "https://www.fakenamegenerator.com/" },
      { label: "This Person Does Not Exist (avatars)", url: "https://thispersondoesnotexist.com/" },
      { label: "temp-mail (burner email)", url: "https://temp-mail.org/" },
      { label: "10 Minute Mail (burner email)", url: "https://10minutemail.com/" },
      { label: "receive-smss (burner numbers)", url: "https://receive-smss.com/" },
      { label: "crt.sh (certificate transparency)", url: "https://crt.sh/" }
    ]
  },
  scanning: {
    guides: [
      { label: "Nmap reference guide", url: "https://nmap.org/book/man.html" },
      { label: "HackTricks — Pentesting Network", url: "https://book.hacktricks.xyz/generic-methodologies-and-resources/pentesting-network" }
    ],
    videos: [{ label: "Nmap enumeration tutorial", url: yt("nmap enumeration tutorial") }],
    tools: [
      { label: "Shodan", url: "https://www.shodan.io/" },
      { label: "Nmap", url: "https://nmap.org/" }
    ]
  },
  vulnerability: {
    guides: [
      { label: "NVD — National Vulnerability Database", url: "https://nvd.nist.gov/" },
      { label: "CVE Details", url: "https://www.cvedetails.com/" },
      { label: "OWASP Top Ten", url: "https://owasp.org/www-project-top-ten/" }
    ],
    videos: [
      { label: "Vulnerability analysis methodology", url: yt("vulnerability analysis methodology tutorial") },
      { label: "Using Nuclei for vuln scanning", url: yt("nuclei vulnerability scanning tutorial") }
    ],
    tools: [
      { label: "Exploit-DB", url: "https://www.exploit-db.com/" },
      { label: "Nuclei templates", url: "https://github.com/projectdiscovery/nuclei-templates" },
      { label: "Vulners", url: "https://vulners.com/" }
    ]
  },
  exploitation: {
    guides: [
      { label: "HackTricks — Exploiting", url: "https://book.hacktricks.xyz/" },
      { label: "PayloadsAllTheThings", url: "https://github.com/swisskyrepo/PayloadsAllTheThings" }
    ],
    videos: [{ label: "Metasploit fundamentals", url: yt("metasploit fundamentals tutorial") }],
    tools: [
      { label: "Metasploit", url: "https://www.metasploit.com/" },
      { label: "GTFOBins", url: "https://gtfobins.github.io/" }
    ]
  },
  post: {
    guides: [
      { label: "HackTricks — Privilege Escalation", url: "https://book.hacktricks.xyz/linux-hardening/privilege-escalation" },
      { label: "MITRE ATT&CK", url: "https://attack.mitre.org/" }
    ],
    videos: [{ label: "Privilege escalation techniques", url: yt("privilege escalation techniques tutorial") }],
    tools: [
      { label: "LinPEAS / WinPEAS", url: "https://github.com/carlospolop/PEASS-ng" },
      { label: "GTFOBins", url: "https://gtfobins.github.io/" }
    ]
  },
  reporting: {
    guides: [
      { label: "PTES — Reporting", url: "http://www.pentest-standard.org/index.php/Reporting" },
      { label: "OSCP-style report templates", url: "https://github.com/noraj/OSCP-Exam-Report-Template-Markdown" }
    ],
    videos: [{ label: "Writing a pentest report", url: yt("how to write a penetration test report") }],
    tools: [{ label: "MITRE ATT&CK Navigator", url: "https://mitre-attack.github.io/attack-navigator/" }]
  },
  general: {
    guides: [
      { label: "OWASP Testing Guide", url: "https://owasp.org/www-project-web-security-testing-guide/" },
      { label: "HackTricks", url: "https://book.hacktricks.xyz/" }
    ],
    videos: [{ label: "Penetration testing methodology", url: yt("penetration testing methodology overview") }],
    tools: [{ label: "OSINT Framework", url: "https://osintframework.com/" }]
  }
};

export function resourcesForPhase(title: string): PhaseResources {
  return RESOURCES[categorize(title)];
}
