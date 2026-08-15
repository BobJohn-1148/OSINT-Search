/**
 * Expansion tools land in a new migration because the original catalog CHECK
 * constraint only allowed Phase 7 categories. If we inserted new categories
 * without rebuilding the table, existing local databases would reject the safer
 * gated catalog entries and drift from fresh installs.
 */
import type { ReacherDatabase } from "../database.js";

const expandedTools = [
  ["subfinder", "subfinder", "Passive subdomain discovery from ProjectDiscovery.", "go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest", "https://github.com/projectdiscovery/subfinder", "recon", "passive", ["subfinder", "-d"]],
  ["dnsx", "dnsx", "DNS resolver and enrichment in the ProjectDiscovery chain.", "go install github.com/projectdiscovery/dnsx/cmd/dnsx@latest", "https://github.com/projectdiscovery/dnsx", "recon", "passive", ["dnsx", "-d"]],
  ["httpx", "httpx", "HTTP probing and fingerprinting for discovered hosts.", "go install github.com/projectdiscovery/httpx/cmd/httpx@latest", "https://github.com/projectdiscovery/httpx", "web", "active", ["httpx", "-u"]],
  ["naabu", "naabu", "Fast port discovery for authorized targets.", "go install github.com/projectdiscovery/naabu/v2/cmd/naabu@latest", "https://github.com/projectdiscovery/naabu", "network", "active", ["naabu", "-host"]],
  ["nuclei", "nuclei", "Template-based vulnerability scanner for authorized targets.", "go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest", "https://github.com/projectdiscovery/nuclei", "web", "active", ["nuclei", "-u"]],
  ["katana", "katana", "Crawler for authorized web application mapping.", "go install github.com/projectdiscovery/katana/cmd/katana@latest", "https://github.com/projectdiscovery/katana", "crawler", "active", ["katana", "-u"]],
  ["amass", "Amass", "Deep asset mapping and attack surface enumeration.", "sudo apt install amass", "https://github.com/owasp-amass/amass", "recon", "active", ["amass", "enum", "-d"]],
  ["masscan", "masscan", "Very fast authorized port sweeps for owned ranges.", "sudo apt install masscan", "https://github.com/robertdavidgraham/masscan", "network", "active", ["masscan"]],
  ["rustscan", "RustScan", "Fast port sweep that can feed nmap for authorized targets.", "cargo install rustscan", "https://github.com/RustScan/RustScan", "network", "active", ["rustscan", "-a"]],
  ["nikto", "Nikto", "Web server checks for authorized targets.", "sudo apt install nikto", "https://github.com/sullo/nikto", "web", "active", ["nikto", "-h"]],
  ["wpscan", "WPScan", "WordPress security scanner for authorized sites.", "gem install wpscan", "https://github.com/wpscanteam/wpscan", "web", "active", ["wpscan", "--url"]],
  ["whatweb", "WhatWeb", "Web technology fingerprinting.", "sudo apt install whatweb", "https://github.com/urbanadventurer/WhatWeb", "web", "active", ["whatweb"]],
  ["wafw00f", "wafw00f", "WAF fingerprinting for authorized web targets.", "pipx install wafw00f", "https://github.com/EnableSecurity/wafw00f", "web", "active", ["wafw00f"]],
  ["enum4linux-ng", "enum4linux-ng", "SMB enumeration for authorized Windows targets.", "pipx install enum4linux-ng", "https://github.com/cddmp/enum4linux-ng", "network", "active", ["enum4linux-ng"]],
  ["dnsrecon", "dnsrecon", "DNS enumeration and zone-transfer checks.", "sudo apt install dnsrecon", "https://github.com/darkoperator/dnsrecon", "recon", "active", ["dnsrecon", "-d"]],
  ["metasploit", "Metasploit Framework", "Authorized exploitation framework catalog entry; Reacher only gates and launches fixed argv.", "curl https://raw.githubusercontent.com/rapid7/metasploit-framework/master/msfinstall | sh", "https://github.com/rapid7/metasploit-framework", "exploitation", "active", ["msfconsole", "-q"]],
  ["sqlmap", "sqlmap", "SQL injection testing for explicitly authorized targets.", "sudo apt install sqlmap", "https://github.com/sqlmapproject/sqlmap", "exploitation", "active", ["sqlmap", "-u"]],
  ["commix", "Commix", "Command injection testing for authorized targets.", "sudo apt install commix", "https://github.com/commixproject/commix", "exploitation", "active", ["commix", "-u"]],
  ["dalfox", "Dalfox", "XSS scanner for authorized targets.", "go install github.com/hahwul/dalfox/v2@latest", "https://github.com/hahwul/dalfox", "exploitation", "active", ["dalfox", "url"]],
  ["xsstrike", "XSStrike", "XSS analysis for authorized web targets.", "git clone https://github.com/s0md3v/XSStrike && cd XSStrike && pip install -r requirements.txt", "https://github.com/s0md3v/XSStrike", "exploitation", "active", ["xsstrike", "-u"]],
  ["tplmap", "tplmap", "SSTI scanner for authorized targets.", "git clone https://github.com/epinna/tplmap && cd tplmap && pip install -r requirements.txt", "https://github.com/epinna/tplmap", "exploitation", "active", ["tplmap", "-u"]],
  ["ssrfmap", "SSRFmap", "SSRF test helper for authorized labs and targets.", "git clone https://github.com/swisskyrepo/SSRFmap && cd SSRFmap && pip install -r requirements.txt", "https://github.com/swisskyrepo/SSRFmap", "exploitation", "active", ["ssrfmap", "-r"]],
  ["hydra", "Hydra", "Network login testing for authorized systems only.", "sudo apt install hydra", "https://github.com/vanhauser-thc/thc-hydra", "exploitation", "active", ["hydra"]],
  ["medusa", "Medusa", "Network login testing for authorized systems only.", "sudo apt install medusa", "https://github.com/jmk-foofus/medusa", "exploitation", "active", ["medusa"]],
  ["netexec", "NetExec", "AD and SMB assessment for authorized environments.", "pipx install git+https://github.com/Pennyw0rth/NetExec", "https://github.com/Pennyw0rth/NetExec", "exploitation", "active", ["nxc"]],
  ["impacket", "Impacket", "Protocol tooling for authorized Windows network assessment.", "pipx install impacket", "https://github.com/fortra/impacket", "exploitation", "active", ["impacket-smbclient"]],
  ["hashcat", "hashcat", "Local password hash cracking on user-supplied hashes.", "sudo apt install hashcat", "https://hashcat.net/hashcat/", "cracking", "passive", ["hashcat"]],
  ["john", "John the Ripper", "Local password hash cracking on user-supplied hashes.", "sudo apt install john", "https://www.openwall.com/john/", "cracking", "passive", ["john"]],
  ["name-that-hash", "Name That Hash", "Local hash identifier.", "pipx install name-that-hash", "https://github.com/HashPals/Name-That-Hash", "cracking", "passive", ["nth"]],
  ["cewl", "CeWL", "Wordlist generation from authorized sites.", "sudo apt install cewl", "https://github.com/digininja/CeWL", "cracking", "active", ["cewl"]],
  ["binwalk", "binwalk", "Firmware inspection and extraction.", "sudo apt install binwalk", "https://github.com/ReFirmLabs/binwalk", "forensics", "passive", ["binwalk"]],
  ["exiftool", "ExifTool", "Metadata and GPS extraction from local files.", "sudo apt install libimage-exiftool-perl", "https://exiftool.org/", "forensics", "passive", ["exiftool"]],
  ["steghide", "steghide", "Steganography extraction from local files.", "sudo apt install steghide", "https://steghide.sourceforge.net/", "forensics", "passive", ["steghide", "info"]],
  ["zsteg", "zsteg", "PNG and BMP steganography inspection.", "gem install zsteg", "https://github.com/zed-0xff/zsteg", "forensics", "passive", ["zsteg"]],
  ["volatility3", "Volatility 3", "Memory image forensics.", "pipx install volatility3", "https://github.com/volatilityfoundation/volatility3", "forensics", "passive", ["vol"]],
  ["radare2", "radare2", "Reverse engineering toolkit for local binaries.", "sudo apt install radare2", "https://github.com/radareorg/radare2", "reverse-engineering", "passive", ["r2"]],
  ["rizin", "Rizin", "Reverse engineering framework for local binaries.", "sudo apt install rizin", "https://github.com/rizinorg/rizin", "reverse-engineering", "passive", ["rizin"]],
  ["ropgadget", "ROPgadget", "ROP gadget search for local binaries.", "pipx install ropgadget", "https://github.com/JonathanSalwan/ROPgadget", "reverse-engineering", "passive", ["ROPgadget", "--binary"]],
  ["checksec", "checksec", "Binary hardening checks.", "sudo apt install checksec", "https://github.com/slimm609/checksec", "reverse-engineering", "passive", ["checksec", "--file"]],
  ["pwntools", "pwntools", "CTF and binary analysis helper.", "pipx install pwntools", "https://github.com/Gallopsled/pwntools", "reverse-engineering", "passive", ["pwn"]],
  ["capa", "capa", "Capability detection in local binaries.", "pipx install flare-capa", "https://github.com/mandiant/capa", "reverse-engineering", "passive", ["capa"]],
  ["yara", "YARA", "Rule-based file and memory artifact matching.", "sudo apt install yara", "https://github.com/VirusTotal/yara", "forensics", "passive", ["yara"]],
  ["linpeas", "LinPEAS", "Linux privilege escalation checklist for authorized hosts.", "curl -L https://github.com/peass-ng/PEASS-ng/releases/latest/download/linpeas.sh -o linpeas.sh", "https://github.com/peass-ng/PEASS-ng", "privilege", "active", ["linpeas.sh"]],
  ["winpeas", "WinPEAS", "Windows privilege escalation checklist for authorized hosts.", "curl -L https://github.com/peass-ng/PEASS-ng/releases/latest/download/winPEASx64.exe -o winPEASx64.exe", "https://github.com/peass-ng/PEASS-ng", "privilege", "active", ["winPEASx64.exe"]],
  ["lse", "linux-smart-enumeration", "Linux local enumeration for authorized hosts.", "git clone https://github.com/diego-treitos/linux-smart-enumeration", "https://github.com/diego-treitos/linux-smart-enumeration", "privilege", "active", ["lse.sh"]],
  ["gtfobins", "GTFOBins lookup", "Offline reference lookup for Unix binary abuse patterns.", "git clone https://github.com/GTFOBins/GTFOBins.github.io", "https://gtfobins.github.io/", "privilege", "passive", ["grep"]],
  ["lolbas", "LOLBAS lookup", "Offline reference lookup for Windows living-off-the-land binaries.", "git clone https://github.com/LOLBAS-Project/LOLBAS", "https://lolbas-project.github.io/", "privilege", "passive", ["grep"]],
  ["scoutsuite", "ScoutSuite", "Cloud security posture assessment for owned accounts.", "pipx install scoutsuite", "https://github.com/nccgroup/ScoutSuite", "cloud", "active", ["scout"]],
  ["prowler", "Prowler", "Cloud security checks for owned accounts.", "pipx install prowler", "https://github.com/prowler-cloud/prowler", "cloud", "active", ["prowler"]],
  ["pacu", "Pacu", "AWS security testing framework for owned accounts.", "pipx install pacu", "https://github.com/RhinoSecurityLabs/pacu", "cloud", "active", ["pacu"]],
  ["trivy", "Trivy", "Container and IaC vulnerability scanner.", "sudo apt install trivy", "https://github.com/aquasecurity/trivy", "cloud", "passive", ["trivy"]],
  ["aircrack-ng", "aircrack-ng", "Wireless lab assessment suite.", "sudo apt install aircrack-ng", "https://www.aircrack-ng.org/", "wireless", "active", ["aircrack-ng"]],
  ["wifite", "Wifite", "Wireless lab audit automation.", "sudo apt install wifite", "https://github.com/derv82/wifite2", "wireless", "active", ["wifite"]],
  ["juice-shop-lab", "OWASP Juice Shop lab", "One-click Docker practice target for legal web testing.", "docker pull bkimminich/juice-shop", "https://owasp.org/www-project-juice-shop/", "lab", "passive", ["docker", "run", "--rm", "-p", "3000:3000", "bkimminich/juice-shop"]],
  ["dvwa-lab", "DVWA lab", "One-click Docker practice target for legal web testing.", "docker pull vulnerables/web-dvwa", "https://github.com/digininja/DVWA", "lab", "passive", ["docker", "run", "--rm", "-p", "8080:80", "vulnerables/web-dvwa"]],
  ["metasploitable-lab", "Metasploitable lab", "Practice target reference entry for owned lab networks.", "download the official VM image from Rapid7", "https://docs.rapid7.com/metasploit/metasploitable-2/", "lab", "passive", ["echo", "Import the Metasploitable VM into an isolated lab network"]],
  ["bwapp-lab", "bWAPP lab", "One-click Docker practice target for legal web testing.", "docker pull raesene/bwapp", "http://www.itsecgames.com/", "lab", "passive", ["docker", "run", "--rm", "-p", "8081:80", "raesene/bwapp"]],
  ["adb", "Android Debug Bridge", "Local Android device inventory after USB debugging approval.", "sudo apt install adb", "https://developer.android.com/tools/adb", "mobile", "passive", ["adb", "devices", "-l"]],
  ["libimobiledevice", "libimobiledevice", "Local iOS device inventory after trust approval.", "sudo apt install libimobiledevice-utils ideviceinstaller", "https://libimobiledevice.org/", "mobile", "passive", ["idevice_id", "-l"]],
  ["maigret-social", "Maigret social analyzer", "Public social profile discovery across hundreds of sites.", "pip install maigret", "https://github.com/soxoj/maigret", "social", "passive", ["maigret"]],
  ["whatsmyname", "WhatsMyName", "Curated username detection data for public profiles.", "git clone https://github.com/WebBreacher/WhatsMyName", "https://github.com/WebBreacher/WhatsMyName", "social", "passive", ["python3", "wmn.py"]]
] as const;

export const migration016ToolsMobileSocial = {
  id: 16,
  name: "tools-mobile-social",
  up(db: ReacherDatabase): void {
    db.exec(`
      ALTER TABLE tool_catalog RENAME TO tool_catalog_phase7;
      ALTER TABLE tool_runs RENAME TO tool_runs_phase7;

      CREATE TABLE tool_catalog (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        install_command TEXT NOT NULL,
        official_link TEXT NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('recon', 'username', 'email', 'phone', 'crawler', 'network', 'packet', 'framework', 'web', 'exploitation', 'cracking', 'forensics', 'reverse-engineering', 'privilege', 'cloud', 'wireless', 'lab', 'mobile', 'social')),
        tier TEXT NOT NULL CHECK (tier IN ('passive', 'active')),
        default_args_json TEXT NOT NULL CHECK (json_valid(default_args_json))
      ) STRICT;

      CREATE TABLE tool_runs (
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

      INSERT INTO tool_catalog (id, name, description, install_command, official_link, category, tier, default_args_json)
      SELECT id, name, description, install_command, official_link, category, tier, default_args_json
      FROM tool_catalog_phase7;

      INSERT INTO tool_runs (id, tool_id, case_id, target, wsl_distro, argv_json, status, stdout, stderr, started_ts, completed_ts, authorization_id)
      SELECT id, tool_id, case_id, target, wsl_distro, argv_json, status, stdout, stderr, started_ts, completed_ts, authorization_id
      FROM tool_runs_phase7;

      DROP TABLE tool_runs_phase7;
      DROP TABLE tool_catalog_phase7;

      CREATE TABLE IF NOT EXISTS mobile_device_snapshots (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
        device_id TEXT NOT NULL,
        label TEXT NOT NULL,
        data_types_json TEXT NOT NULL CHECK (json_valid(data_types_json)),
        captured_ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;
    `);

    const insert = db.prepare(
      `INSERT OR IGNORE INTO tool_catalog
       (id, name, description, install_command, official_link, category, tier, default_args_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const tool of expandedTools) {
      insert.run(tool[0], tool[1], tool[2], tool[3], tool[4], tool[5], tool[6], JSON.stringify(tool[7]));
    }
  }
} as const;
