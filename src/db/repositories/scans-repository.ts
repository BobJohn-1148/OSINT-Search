/**
 * Scan persistence owns parsed nmap rows because topology and reports must read
 * the same durable host/service data. If parsing code wrote tables directly,
 * report export could drift from the network scan view after small schema edits.
 */
import { randomUUID } from "node:crypto";
import type { ReacherDatabase } from "../database.js";
import type { ScanHost, ScanOptions, ScanPort, ScanRecord } from "../../shared/schemas/scans.js";
import type { ScanStatus, ScanTiming, ScanType } from "../../shared/types/scans.js";

interface ScanRow {
  readonly id: string;
  readonly target: string;
  readonly wsl_distro: string;
  readonly status: ScanStatus;
  readonly scan_type: ScanType;
  readonly timing: ScanTiming;
  readonly argv_json: string;
  readonly stdout: string;
  readonly stderr: string;
  readonly started_ts: string;
  readonly completed_ts: string | null;
  readonly authorization_id: string | null;
}

interface HostRow {
  readonly id: string;
  readonly scan_id: string;
  readonly address: string;
  readonly hostname: string | null;
  readonly status: string;
  readonly hop_distance: number;
}

interface PortRow {
  readonly id: string;
  readonly scan_id: string;
  readonly host_id: string;
  readonly protocol: string;
  readonly port: number;
  readonly state: string;
  readonly service: string;
  readonly product: string;
  readonly version: string;
}

export class ScansRepository {
  public constructor(private readonly db: ReacherDatabase) {}

  public createRun(input: {
    readonly target: string;
    readonly wslDistro: string;
    readonly options: ScanOptions;
    readonly argv: readonly string[];
    readonly status: ScanStatus;
    readonly authorizationId?: string | null;
  }): ScanRecord {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO scans (id, target, wsl_distro, status, scan_type, timing, argv_json, authorization_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.target,
        input.wslDistro,
        input.status,
        input.options.scanType,
        input.options.timing,
        JSON.stringify(input.argv),
        input.authorizationId ?? null
      );
    return this.getScan(id) ?? this.missingScan(id);
  }

  public finishRun(input: {
    readonly scanId: string;
    readonly status: Extract<ScanStatus, "succeeded" | "failed" | "blocked">;
    readonly stdout: string;
    readonly stderr: string;
    readonly hosts: readonly Omit<ScanHost, "id" | "scanId" | "ports">[];
    readonly portsByAddress: ReadonlyMap<string, readonly Omit<ScanPort, "id" | "scanId" | "hostId">[]>;
  }): { readonly scan: ScanRecord; readonly hosts: ScanHost[] } {
    const write = this.db.transaction(() => {
      this.db.prepare("DELETE FROM ports WHERE scan_id = ?").run(input.scanId);
      this.db.prepare("DELETE FROM hosts WHERE scan_id = ?").run(input.scanId);
      this.db
        .prepare(
          `UPDATE scans
           SET status = ?, stdout = ?, stderr = ?, completed_ts = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
           WHERE id = ?`
        )
        .run(input.status, input.stdout, input.stderr, input.scanId);

      const insertHost = this.db.prepare(
        "INSERT INTO hosts (id, scan_id, address, hostname, status, hop_distance) VALUES (?, ?, ?, ?, ?, ?)"
      );
      const insertPort = this.db.prepare(
        `INSERT INTO ports (id, scan_id, host_id, protocol, port, state, service, product, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const host of input.hosts) {
        const hostId = randomUUID();
        insertHost.run(hostId, input.scanId, host.address, host.hostname, host.status, host.hopDistance);
        for (const port of input.portsByAddress.get(host.address) ?? []) {
          insertPort.run(
            randomUUID(),
            input.scanId,
            hostId,
            port.protocol,
            port.port,
            port.state,
            port.service,
            port.product,
            port.version
          );
        }
      }
    });
    write();
    return {
      scan: this.getScan(input.scanId) ?? this.missingScan(input.scanId),
      hosts: this.hosts(input.scanId)
    };
  }

  public get(scanId: string): { readonly scan: ScanRecord | null; readonly hosts: ScanHost[] } {
    return {
      scan: this.getScan(scanId),
      hosts: this.hosts(scanId)
    };
  }

  public latest(): ScanRecord[] {
    const rows = this.db.prepare("SELECT * FROM scans ORDER BY started_ts DESC, id DESC LIMIT 20").all() as ScanRow[];
    return rows.map((row) => this.toScan(row));
  }

  public hosts(scanId: string): ScanHost[] {
    const hostRows = this.db
      .prepare("SELECT * FROM hosts WHERE scan_id = ? ORDER BY hop_distance ASC, address ASC")
      .all(scanId) as HostRow[];
    return hostRows.map((host) => ({
      id: host.id,
      scanId: host.scan_id,
      address: host.address,
      hostname: host.hostname,
      status: host.status,
      hopDistance: host.hop_distance,
      ports: this.ports(host.id)
    }));
  }

  private ports(hostId: string): ScanPort[] {
    const rows = this.db
      .prepare("SELECT * FROM ports WHERE host_id = ? ORDER BY protocol ASC, port ASC")
      .all(hostId) as PortRow[];
    return rows.map((row) => ({
      id: row.id,
      scanId: row.scan_id,
      hostId: row.host_id,
      protocol: row.protocol,
      port: row.port,
      state: row.state,
      service: row.service,
      product: row.product,
      version: row.version
    }));
  }

  private getScan(scanId: string): ScanRecord | null {
    const row = this.db.prepare("SELECT * FROM scans WHERE id = ?").get(scanId) as ScanRow | undefined;
    return row ? this.toScan(row) : null;
  }

  private toScan(row: ScanRow): ScanRecord {
    return {
      id: row.id,
      target: row.target,
      wslDistro: row.wsl_distro,
      status: row.status,
      scanType: row.scan_type,
      timing: row.timing,
      argv: JSON.parse(row.argv_json) as string[],
      stdout: row.stdout,
      stderr: row.stderr,
      startedTs: row.started_ts,
      completedTs: row.completed_ts,
      authorizationId: row.authorization_id
    };
  }

  private missingScan(scanId: string): never {
    throw new Error(`Scan ${scanId} was not persisted`);
  }
}
