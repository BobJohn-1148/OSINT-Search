/**
 * Mobile snapshot persistence is its own repository, not inline SQL in the
 * service, because a detect pass touches device inventory data (IMEI-adjacent
 * identifiers, package lists) that must survive a restart the same way every
 * other analyzer's findings do -- without it, "what phone was here and when"
 * could only be answered by memory of the last detect() call.
 */
import { randomUUID } from "node:crypto";
import type { ReacherDatabase } from "../database.js";
import type { MobilePlatform, MobileSnapshot } from "../../shared/schemas/mobile.js";

interface MobileSnapshotRow {
  readonly id: string;
  readonly platform: MobilePlatform;
  readonly device_id: string;
  readonly label: string;
  readonly data_types_json: string;
  readonly captured_ts: string;
}

export interface RecordMobileSnapshotInput {
  readonly platform: MobilePlatform;
  readonly deviceId: string;
  readonly label: string;
  readonly dataTypeIds: readonly string[];
}

export class MobileRepository {
  public constructor(private readonly db: ReacherDatabase) {}

  public recordSnapshot(input: RecordMobileSnapshotInput): MobileSnapshot {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO mobile_device_snapshots (id, platform, device_id, label, data_types_json)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(id, input.platform, input.deviceId, input.label, JSON.stringify(input.dataTypeIds));
    return this.getById(id);
  }

  public listSnapshots(limit: number): MobileSnapshot[] {
    const rows = this.db
      .prepare("SELECT * FROM mobile_device_snapshots ORDER BY captured_ts DESC, id DESC LIMIT ?")
      .all(limit) as MobileSnapshotRow[];
    return rows.map(toSnapshot);
  }

  private getById(id: string): MobileSnapshot {
    const row = this.db.prepare("SELECT * FROM mobile_device_snapshots WHERE id = ?").get(id) as MobileSnapshotRow | undefined;
    if (!row) {
      throw new Error(`Mobile snapshot ${id} was not persisted`);
    }
    return toSnapshot(row);
  }
}

function toSnapshot(row: MobileSnapshotRow): MobileSnapshot {
  return {
    id: row.id,
    platform: row.platform,
    deviceId: row.device_id,
    label: row.label,
    dataTypeIds: JSON.parse(row.data_types_json) as string[],
    capturedTs: row.captured_ts
  };
}
