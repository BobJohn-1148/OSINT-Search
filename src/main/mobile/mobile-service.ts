/**
 * MobileService probes attached phones from main with fixed argv because USB
 * inventory is host IO. If the renderer ran adb or parsed arbitrary commands,
 * phone access would bypass typed IPC and the audit trail for sensitive device
 * metadata would be impossible to reason about.
 */
import { execFile } from "node:child_process";
import type { MobileDataType, MobileDetectResponse, MobileProfilesResponse } from "../../shared/schemas/mobile.js";

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
  public constructor(private readonly runCommand: MobileCommandRunner = runFixedCommand) {}

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

    return { devices, unavailableTools };
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
