/**
 * MobileService probes attached phones from main with fixed argv because USB
 * inventory is host IO. If the renderer ran adb or parsed arbitrary commands,
 * phone access would bypass typed IPC and the audit trail for sensitive device
 * metadata would be impossible to reason about.
 *
 * Every successful detect() also persists one snapshot row per device (via
 * MobileRepository) and one audit event for the pass as a whole. Without this,
 * "what phone was here and when" was unanswerable after the fact -- detect()
 * only ever returned an in-memory list to the renderer and nothing else in the
 * app recorded that a device probe touched sensitive inventory data, unlike
 * every other analyzer (EVTX, PCAP, email headers) which all audit on import.
 */
import { execFile } from "node:child_process";
import type { MobileDataType, MobileDetectResponse, MobileProfilesResponse, MobileSnapshotsResponse } from "../../shared/schemas/mobile.js";
import type { AuditRepository } from "../../db/repositories/audit-repository.js";
import type { MobileRepository } from "../../db/repositories/mobile-repository.js";

export type MobileCommandRunner = (
  command: string,
  args: readonly string[],
  options: { readonly timeoutMs: number }
) => Promise<{ readonly stdout: string; readonly stderr: string }>;

const androidDataTypes: readonly MobileDataType[] = [
  {
    id: "android-device-info",
    label: "Device info",
    sensitivity: "medium",
    description: "Model, build, serial, Android version, and manufacturer reported through getprop.",
    commandPreview: ["adb", "shell", "getprop"]
  },
  {
    id: "android-packages",
    label: "Installed packages",
    sensitivity: "high",
    description: "Application package inventory from the approved debug session.",
    commandPreview: ["adb", "shell", "pm", "list", "packages", "-f"]
  },
  {
    id: "android-battery",
    label: "Battery and power",
    sensitivity: "low",
    description: "Battery, charging, and power-state diagnostics.",
    commandPreview: ["adb", "shell", "dumpsys", "battery"]
  },
  {
    id: "android-network",
    label: "Network interfaces",
    sensitivity: "medium",
    description: "Local interface and route metadata from the attached device.",
    commandPreview: ["adb", "shell", "ip", "addr"]
  }
];

const iosDataTypes: readonly MobileDataType[] = [
  {
    id: "ios-device-info",
    label: "Device info",
    sensitivity: "medium",
    description: "Trusted-pairing device inventory from ideviceinfo.",
    commandPreview: ["ideviceinfo"]
  },
  {
    id: "ios-apps",
    label: "Installed apps",
    sensitivity: "high",
    description: "Application inventory available through libimobiledevice tools.",
    commandPreview: ["ideviceinstaller", "-l"]
  },
  {
    id: "ios-diagnostics",
    label: "Diagnostics",
    sensitivity: "medium",
    description: "Diagnostic metadata available after the user trusts this computer.",
    commandPreview: ["idevicediagnostics", "diagnostics"]
  }
];

export class MobileService {
  public constructor(
    private readonly mobileRepository: MobileRepository,
    private readonly auditRepository: AuditRepository,
    private readonly runCommand: MobileCommandRunner = runFixedCommand
  ) {}

  public profiles(): MobileProfilesResponse {
    return {
      profiles: [
        { platform: "android", label: "Android", requiredTool: "adb", dataTypes: [...androidDataTypes] },
        { platform: "ios", label: "Apple iOS", requiredTool: "libimobiledevice", dataTypes: [...iosDataTypes] }
      ]
    };
  }

  public async detect(): Promise<MobileDetectResponse> {
    const unavailableTools: string[] = [];
    const devices = [];

    const android = await this.tryRun("adb", ["devices", "-l"]);
    if (android) {
      devices.push(...parseAndroidDevices(android.stdout));
    } else {
      unavailableTools.push("adb");
    }

    const ios = await this.tryRun("idevice_id", ["-l"]);
    if (ios) {
      devices.push(...parseIosDevices(ios.stdout));
    } else {
      unavailableTools.push("libimobiledevice");
    }

    for (const device of devices) {
      this.mobileRepository.recordSnapshot({
        platform: device.platform,
        deviceId: device.id,
        label: device.label,
        dataTypeIds: device.dataTypes.map((dataType) => dataType.id)
      });
    }

    if (devices.length > 0) {
      this.auditRepository.record({
        actor: "local-user",
        action: "mobile.detect",
        objectType: "mobile_detect",
        objectId: null,
        sensitivity: "high",
        detail: {
          deviceCount: devices.length,
          platforms: [...new Set(devices.map((device) => device.platform))],
          unavailableTools
        }
      });
    }

    return { devices, unavailableTools };
  }

  public snapshots(limit: number): MobileSnapshotsResponse {
    return { snapshots: this.mobileRepository.listSnapshots(limit) };
  }

  private async tryRun(command: string, args: readonly string[]) {
    try {
      return await this.runCommand(command, args, { timeoutMs: 5_000 });
    } catch {
      return null;
    }
  }
}

function parseAndroidDevices(stdout: string): MobileDetectResponse["devices"] {
  return stdout
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line && !line.includes("offline") && !line.includes("unauthorized"))
    .map((line) => {
      const [id] = line.split(/\s+/);
      return {
        id,
        platform: "android" as const,
        label: line,
        connected: true,
        dataTypes: [...androidDataTypes]
      };
    });
}

function parseIosDevices(stdout: string): MobileDetectResponse["devices"] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((id) => ({
      id,
      platform: "ios" as const,
      label: `iOS device ${id}`,
      connected: true,
      dataTypes: [...iosDataTypes]
    }));
}

function runFixedCommand(command: string, args: readonly string[], options: { readonly timeoutMs: number }) {
  return new Promise<{ readonly stdout: string; readonly stderr: string }>((resolve, reject) => {
    execFile(command, [...args], { timeout: options.timeoutMs, shell: false }, (error, stdout, stderr) => {
      if (error) {
        reject(error instanceof Error ? error : new Error("Mobile command failed"));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}
