/**
 * Tool tables live in their own migration because WSL launches are durable local
 * actions with authorization state, not transient renderer commands. If catalog,
 * approvals, and output capture were kept in UI memory, active scans could not
 * be audited or attached back to cases.
 */
import type { ReacherDatabase } from "../database.js";

const seededTools = [
  {
    id: "reconftw",
    name: "reconFTW",
    description: "Recon workflow for broad domain enumeration and validation.",
    installCommand: "git clone https://github.com/six2dez/reconftw && cd reconftw && ./install.sh",
    officialLink: "https://github.com/six2dez/reconftw",
    category: "recon",
    tier: "active",
    defaultArgs: ["reconftw", "-d"]
  },
  {
    id: "argus",
    name: "Argus",
    description: "Passive reconnaissance helper for host and exposure review.",
    installCommand: "pip install argus-recon",
    officialLink: "https://github.com/jasonxtn/Argus",
    category: "recon",
    tier: "passive",
    defaultArgs: ["argus"]
  },
  {
    id: "maigret",
    name: "Maigret",
    description: "Username search across public sites.",
    installCommand: "pip install maigret",
    officialLink: "https://github.com/soxoj/maigret",
    category: "username",
    tier: "passive",
    defaultArgs: ["maigret"]
  },
  {
    id: "blackbird",
    name: "Blackbird",
    description: "Username discovery and account correlation.",
    installCommand: "git clone https://github.com/p1ngul1n0/blackbird && cd blackbird && pip install -r requirements.txt",
    officialLink: "https://github.com/p1ngul1n0/blackbird",
    category: "username",
    tier: "passive",
    defaultArgs: ["blackbird", "-u"]
  },
  {
    id: "photon",
    name: "Photon",
    description: "Passive web crawler for URL and artifact discovery.",
    installCommand: "sudo apt install photon",
    officialLink: "https://github.com/s0md3v/Photon",
    category: "crawler",
    tier: "passive",
    defaultArgs: ["photon", "-u"]
  },
  {
    id: "theharvester",
    name: "theHarvester",
    description: "Email, domain, and host enumeration from public sources.",
    installCommand: "pipx install theHarvester",
    officialLink: "https://github.com/laramies/theHarvester",
    category: "email",
    tier: "passive",
    defaultArgs: ["theHarvester", "-d"]
  },
  {
    id: "sherlock",
    name: "Sherlock",
    description: "Username lookup across public social sites.",
    installCommand: "pipx install sherlock-project",
    officialLink: "https://github.com/sherlock-project/sherlock",
    category: "username",
    tier: "passive",
    defaultArgs: ["sherlock"]
  },
  {
    id: "phoneinfoga",
    name: "PhoneInfoga",
    description: "Phone number reconnaissance from public telecom metadata.",
    installCommand: "docker run ... sundowndev/phoneinfoga",
    officialLink: "https://github.com/sundowndev/phoneinfoga",
    category: "phone",
    tier: "passive",
    defaultArgs: ["phoneinfoga", "scan", "-n"]
  },
  {
    id: "spiderfoot",
    name: "SpiderFoot",
    description: "OSINT automation framework with passive and active modules.",
    installCommand: "pip install spiderfoot",
    officialLink: "https://github.com/smicallef/spiderfoot",
    category: "framework",
    tier: "active",
    defaultArgs: ["spiderfoot", "-s"]
  },
  {
    id: "nmap",
    name: "nmap",
    description: "Authorized network scanning and service discovery.",
    installCommand: "sudo apt install nmap",
    officialLink: "https://nmap.org/",
    category: "network",
    tier: "active",
    defaultArgs: ["nmap"]
  },
  {
    id: "tshark",
    name: "tshark",
    description: "Packet capture inspection and protocol extraction.",
    installCommand: "sudo apt install tshark",
    officialLink: "https://www.wireshark.org/docs/man-pages/tshark.html",
    category: "packet",
    tier: "passive",
    defaultArgs: ["tshark", "-r"]
  }
] as const;

export const migration011Tools = {
  id: 11,
  name: "tools-wsl",
  up(db: ReacherDatabase): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS tool_catalog (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        install_command TEXT NOT NULL,
        official_link TEXT NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('recon', 'username', 'email', 'phone', 'crawler', 'network', 'packet', 'framework')),
        tier TEXT NOT NULL CHECK (tier IN ('passive', 'active')),
        default_args_json TEXT NOT NULL CHECK (json_valid(default_args_json))
      ) STRICT;

      CREATE TABLE IF NOT EXISTS authorizations (
        id TEXT PRIMARY KEY,
        target TEXT NOT NULL,
        tier TEXT NOT NULL CHECK (tier IN ('passive', 'active')),
        created_ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        expires_ts TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS tool_runs (
        id TEXT PRIMARY KEY,
        tool_id TEXT NOT NULL,
        case_id TEXT,
        target TEXT NOT NULL,
        wsl_distro TEXT NOT NULL,
        argv_json TEXT NOT NULL CHECK (json_valid(argv_json)),
        status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'blocked')),
        stdout TEXT NOT NULL DEFAULT '',
        stderr TEXT NOT NULL DEFAULT '',
        started_ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        completed_ts TEXT,
        authorization_id TEXT,
        FOREIGN KEY (tool_id) REFERENCES tool_catalog(id) ON DELETE RESTRICT,
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL,
        FOREIGN KEY (authorization_id) REFERENCES authorizations(id) ON DELETE SET NULL
      ) STRICT;
    `);

    const insert = db.prepare(
      `INSERT OR IGNORE INTO tool_catalog
       (id, name, description, install_command, official_link, category, tier, default_args_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const tool of seededTools) {
      insert.run(
        tool.id,
        tool.name,
        tool.description,
        tool.installCommand,
        tool.officialLink,
        tool.category,
        tool.tier,
        JSON.stringify(tool.defaultArgs)
      );
    }
  }
} as const;
