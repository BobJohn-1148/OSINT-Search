/**
 * Adds passive iPhone data-acquisition and backup-analysis tools to existing
 * catalogs. These entries do not imply bypassing device protections: they cover
 * trusted pairing, user-created backups, visible screenshots, logs, crash
 * reports, and parser workflows over examiner-provided extractions.
 */
import type { ReacherDatabase } from "../database.js";

const iosMobileTools = [
  [
    "idevicebackup2",
    "idevicebackup2",
    "Creates or restores iOS backups from a trusted iPhone; useful before parsing with MVT or iLEAPP.",
    "Install libimobiledevice tools, then run idevicebackup2 against a trusted iPhone.",
    "https://libimobiledevice.org/",
    "mobile",
    "passive",
    ["idevicebackup2", "backup"]
  ],
  [
    "idevicecrashreport",
    "idevicecrashreport",
    "Copies iOS app crash reports from a trusted iPhone into a local evidence folder.",
    "Install libimobiledevice tools, then run idevicecrashreport against a trusted iPhone.",
    "https://libimobiledevice.org/",
    "mobile",
    "passive",
    ["idevicecrashreport"]
  ],
  [
    "idevicesyslog",
    "idevicesyslog",
    "Streams iOS device logs from a trusted pairing for short, consented troubleshooting captures.",
    "Install libimobiledevice tools, then run idevicesyslog against a trusted iPhone.",
    "https://libimobiledevice.org/",
    "mobile",
    "passive",
    ["idevicesyslog"]
  ],
  [
    "idevicescreenshot",
    "idevicescreenshot",
    "Captures the visible iPhone screen through a trusted pairing.",
    "Install libimobiledevice tools, then run idevicescreenshot against a trusted iPhone.",
    "https://libimobiledevice.org/",
    "mobile",
    "passive",
    ["idevicescreenshot"]
  ],
  [
    "ideviceinstaller",
    "ideviceinstaller",
    "Lists installed iOS apps exposed through trusted pairing services.",
    "Install ideviceinstaller with libimobiledevice support.",
    "https://libimobiledevice.org/",
    "mobile",
    "passive",
    ["ideviceinstaller", "-l"]
  ],
  [
    "pymobiledevice3",
    "pymobiledevice3",
    "Python iOS tooling for trusted-device discovery, syslog/oslog, apps, profiles, AFC files, crash reports, PCAP, backups, and developer diagnostics.",
    "pipx install pymobiledevice3",
    "https://github.com/doronz88/pymobiledevice3",
    "mobile",
    "passive",
    ["pymobiledevice3"]
  ],
  [
    "mvt-ios",
    "MVT iOS",
    "Consensual iOS forensic analysis for backups and filesystem dumps, especially compromise-trace checks with IOCs.",
    "pipx install mvt",
    "https://mvt.re/",
    "mobile",
    "passive",
    ["mvt-ios", "check-backup"]
  ],
  [
    "ileapp",
    "iLEAPP",
    "Parses iOS and iPadOS forensic extractions/backups into examiner-friendly HTML, TSV, timeline, KML, and LAVA output.",
    "git clone https://github.com/abrignoni/iLEAPP && cd iLEAPP && python -m pip install -r requirements.txt",
    "https://github.com/abrignoni/iLEAPP",
    "mobile",
    "passive",
    ["python3", "ileapp.py", "-i"]
  ],
  [
    "ifuse",
    "ifuse",
    "Mounts iOS device-accessible filesystem areas locally over trusted pairing/FUSE where the device permits access.",
    "sudo apt install ifuse",
    "https://github.com/libimobiledevice/ifuse",
    "mobile",
    "passive",
    ["ifuse"]
  ],
  [
    "imazing-cli",
    "iMazing CLI",
    "Commercial Windows/macOS CLI for scripted iOS backup, file transfer, backup restore, and data extraction workflows.",
    "Install iMazing, then enable/use its CLI from https://imazing.com/cli",
    "https://imazing.com/cli",
    "mobile",
    "passive",
    ["imazing"]
  ]
] as const;

export const migration018IosMobileToolCatalog = {
  id: 18,
  name: "ios-mobile-tool-catalog",
  up(db: ReacherDatabase): void {
    const insert = db.prepare(
      `INSERT OR IGNORE INTO tool_catalog
       (id, name, description, install_command, official_link, category, tier, default_args_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const tool of iosMobileTools) {
      insert.run(tool[0], tool[1], tool[2], tool[3], tool[4], tool[5], tool[6], JSON.stringify(tool[7]));
    }
  }
} as const;
