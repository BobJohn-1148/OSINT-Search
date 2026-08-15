/**
 * Scan tables are split from generic tool runs because parsed hosts and ports
 * need stable identities for topology and report export. If nmap output only
 * lived as stdout text, Jack could not compare scans or cite host/service rows.
 */
import type { ReacherDatabase } from "../database.js";

export const migration012Scans = {
  id: 12,
  name: "scan-topology",
  up(db: ReacherDatabase): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS scans (
        id TEXT PRIMARY KEY,
        target TEXT NOT NULL,
        wsl_distro TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'blocked')),
        scan_type TEXT NOT NULL CHECK (scan_type IN ('ping-sweep', 'quick-top-100', 'full-tcp', 'service-version', 'os-detect', 'vuln-nse', 'custom')),
        timing TEXT NOT NULL CHECK (timing IN ('T2', 'T3', 'T4')),
        argv_json TEXT NOT NULL CHECK (json_valid(argv_json)),
        stdout TEXT NOT NULL DEFAULT '',
        stderr TEXT NOT NULL DEFAULT '',
        started_ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        completed_ts TEXT,
        authorization_id TEXT,
        FOREIGN KEY (authorization_id) REFERENCES authorizations(id) ON DELETE SET NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS hosts (
        id TEXT PRIMARY KEY,
        scan_id TEXT NOT NULL,
        address TEXT NOT NULL,
        hostname TEXT,
        status TEXT NOT NULL,
        hop_distance INTEGER NOT NULL CHECK (hop_distance >= 1),
        FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE,
        UNIQUE (scan_id, address)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS ports (
        id TEXT PRIMARY KEY,
        scan_id TEXT NOT NULL,
        host_id TEXT NOT NULL,
        protocol TEXT NOT NULL,
        port INTEGER NOT NULL CHECK (port >= 0),
        state TEXT NOT NULL,
        service TEXT NOT NULL,
        product TEXT NOT NULL,
        version TEXT NOT NULL,
        FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE,
        FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE,
        UNIQUE (host_id, protocol, port)
      ) STRICT;
    `);
  }
} as const;
