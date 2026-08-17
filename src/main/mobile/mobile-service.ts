/**
 * MobileService probes attached phones from main with fixed argv because USB
 * inventory is host IO. If the renderer ran adb or parsed arbitrary commands,
 * phone access would bypass typed IPC and the audit trail for sensitive device
 * metadata would be impossible to reason about.
 */
import { execFile } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";
import type {
  MobileCollectRequest,
  MobileCollectResponse,
  MobileCollectionResult,
  MobileDataType,
  MobileDetectResponse,
  MobileDevice,
  MobileHostUsbDevice,
  MobileProfilesResponse,
  MobileToolStatus
} from "../../shared/schemas/mobile.js";

export type MobileCommandRunner = (
  command: string,
  args: readonly string[],
  options: { readonly timeoutMs: number; readonly allowPartialOnTimeout?: boolean }
) => Promise<{ readonly stdout: string; readonly stderr: string }>;

interface MobileCommandRecipe {
  readonly label: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly timeoutMs: number;
  readonly allowPartialOnTimeout?: boolean;
}

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
  },
  {
    id: "android-storage",
    label: "Storage and mounts",
    sensitivity: "medium",
    description: "Filesystem usage, mounted volumes, and external storage context.",
    commandPreview: ["adb", "shell", "df", "-h"]
  },
  {
    id: "android-processes",
    label: "Running processes",
    sensitivity: "high",
    description: "Current process table visible through the trusted debug session.",
    commandPreview: ["adb", "shell", "ps", "-A"]
  },
  {
    id: "android-settings",
    label: "System settings",
    sensitivity: "medium",
    description: "Non-secret Android settings namespaces useful for device context and triage.",
    commandPreview: ["adb", "shell", "settings", "list", "secure"]
  },
  {
    id: "android-logcat",
    label: "Recent logcat",
    sensitivity: "sensitive",
    description: "Recent device log snapshot for live troubleshooting context.",
    commandPreview: ["adb", "logcat", "-d", "-t", "400"]
  },
  {
    id: "android-bugreport",
    label: "Bug report bundle",
    sensitivity: "sensitive",
    description: "Large diagnostic report; use only when you explicitly need deep troubleshooting evidence.",
    commandPreview: ["adb", "bugreport"]
  }
];

const iosDataTypes: readonly MobileDataType[] = [
  {
    id: "ios-pairing-status",
    label: "Pairing status",
    sensitivity: "low",
    description: "Validates whether this computer is trusted by the attached iPhone.",
    commandPreview: ["idevicepair", "validate"]
  },
  {
    id: "ios-device-info",
    label: "Device info",
    sensitivity: "medium",
    description: "Trusted-pairing device inventory from ideviceinfo.",
    commandPreview: ["ideviceinfo"]
  },
  {
    id: "ios-device-name-date",
    label: "Name and device time",
    sensitivity: "low",
    description: "Device name and clock metadata for confirming the connected handset.",
    commandPreview: ["idevicename", "&&", "idevicedate"]
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
  },
  {
    id: "ios-screenshot",
    label: "Screenshot",
    sensitivity: "medium",
    description: "One user-visible screen capture from the trusted device.",
    commandPreview: ["idevicescreenshot"]
  },
  {
    id: "ios-crash-reports",
    label: "Crash reports",
    sensitivity: "sensitive",
    description: "Application crash artifacts copied from the device for troubleshooting.",
    commandPreview: ["idevicecrashreport"]
  },
  {
    id: "ios-syslog",
    label: "Live syslog",
    sensitivity: "sensitive",
    description: "Live device log stream; use narrowly because it may include private app metadata.",
    commandPreview: ["idevicesyslog"]
  }
];

export class MobileService {
  private readonly usesDefaultRunner: boolean;

  public constructor(private readonly runCommand: MobileCommandRunner = runFixedCommand) {
    this.usesDefaultRunner = runCommand === runFixedCommand;
  }

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
    const hostUsbDevices = await this.detectHostUsbDevices();

    const android = await this.tryRun("adb", ["devices", "-l"]);
    if (android) {
      devices.push(...parseAndroidDevices(android.stdout));
    } else {
      unavailableTools.push("adb");
    }

    const ios = await this.tryRun("idevice_id", ["-l"]);
    if (ios) {
      devices.push(...await this.parseAndEnrichIosDevices(ios.stdout));
    } else {
      unavailableTools.push("libimobiledevice");
    }

    return { devices, unavailableTools, toolStatus: this.buildToolStatus(android, ios), hostUsbDevices };
  }

  public async collect(request: MobileCollectRequest): Promise<MobileCollectResponse> {
    const sourceDataTypes = request.platform === "android" ? androidDataTypes : iosDataTypes;
    const dataTypes = sourceDataTypes.filter((dataType) => {
      if (request.dataTypeIds) {
        return request.dataTypeIds.includes(dataType.id);
      }
      return this.isDataTypeAvailable(request.platform, request.deviceId, dataType.id);
    });
    const results: MobileCollectionResult[] = [];
    for (const dataType of dataTypes) {
      const startedTs = new Date().toISOString();
      const recipes = buildCollectionRecipes(request.platform, request.deviceId, dataType.id);
      if (recipes.length === 0) {
        results.push({
          dataTypeId: dataType.id,
          label: dataType.label,
          sensitivity: dataType.sensitivity,
          status: "skipped",
          commandPreview: dataType.commandPreview,
          stdout: "",
          stderr: "No bounded collector is implemented for this artifact-producing category yet.",
          summary: "Collector skipped because this category needs an artifact export path.",
          startedTs,
          completedTs: new Date().toISOString()
        });
        continue;
      }
      const chunks: string[] = [];
      const errors: string[] = [];
      const runnableRecipes = recipes.filter((recipe) => !this.usesDefaultRunner || findMobileCommand(recipe.command));
      if (runnableRecipes.length === 0) {
        results.push({
          dataTypeId: dataType.id,
          label: dataType.label,
          sensitivity: dataType.sensitivity,
          status: "skipped",
          commandPreview: dataType.commandPreview,
          stdout: "",
          stderr: `${recipes.map((recipe) => recipe.command).join(", ")} is not installed or was not found in the local mobile tools folder.`,
          summary: `${dataType.label}: skipped because the required local command is missing.`,
          startedTs,
          completedTs: new Date().toISOString()
        });
        continue;
      }
      for (const missingRecipe of recipes.filter((recipe) => this.usesDefaultRunner && !findMobileCommand(recipe.command))) {
        errors.push(formatMobileSection(missingRecipe.label, `${missingRecipe.command} is not installed or was not found.`));
      }
      for (const recipe of runnableRecipes) {
        try {
          const output = await this.runCommand(recipe.command, recipe.args, {
            timeoutMs: recipe.timeoutMs,
            allowPartialOnTimeout: recipe.allowPartialOnTimeout
          });
          chunks.push(formatMobileSection(recipe.label, output.stdout));
          if (output.stderr.trim()) {
            errors.push(formatMobileSection(recipe.label, output.stderr));
          }
        } catch (error) {
          errors.push(formatMobileSection(recipe.label, error instanceof Error ? error.message : "Mobile collector failed"));
        }
      }
      const stdout = chunks.join("\n\n").trim();
      const stderr = errors.join("\n\n").trim();
      results.push({
        dataTypeId: dataType.id,
        label: dataType.label,
        sensitivity: dataType.sensitivity,
        status: stdout ? "passed" : "failed",
        commandPreview: dataType.commandPreview,
        stdout,
        stderr,
        summary: summarizeCollection(dataType.label, stdout, stderr),
        startedTs,
        completedTs: new Date().toISOString()
      });
    }
    return {
      deviceId: request.deviceId,
      platform: request.platform,
      completedTs: new Date().toISOString(),
      results
    };
  }

  private isDataTypeAvailable(platform: MobileCollectRequest["platform"], deviceId: string, dataTypeId: string): boolean {
    const recipes = buildCollectionRecipes(platform, deviceId, dataTypeId);
    if (recipes.length === 0) {
      return false;
    }
    return !this.usesDefaultRunner || recipes.every((recipe) => findMobileCommand(recipe.command));
  }

  private async tryRun(command: string, args: readonly string[]) {
    try {
      return await this.runCommand(command, args, { timeoutMs: 5_000 });
    } catch {
      return null;
    }
  }

  private async parseAndEnrichIosDevices(stdout: string): Promise<MobileDevice[]> {
    const devices = parseIosDevices(stdout);
    return Promise.all(
      devices.map(async (device) => {
        const name = await this.tryRun("ideviceinfo", ["-u", device.id, "-s", "-k", "DeviceName"]);
        const product = await this.tryRun("ideviceinfo", ["-u", device.id, "-s", "-k", "ProductType"]);
        const labelParts = [name?.stdout.trim(), product?.stdout.trim()].filter((part) => part && part.length > 0);
        return {
          ...device,
          label: labelParts.length > 0 ? `${labelParts.join(" / ")} (${device.id})` : device.label
        };
      })
    );
  }

  private buildToolStatus(
    androidProbe: { readonly stdout: string; readonly stderr: string } | null,
    iosProbe: { readonly stdout: string; readonly stderr: string } | null
  ): MobileToolStatus[] {
    return [
      {
        id: "adb",
        label: "Android Platform Tools",
        command: "adb",
        available: androidProbe !== null,
        path: findMobileCommand("adb"),
        detail: androidProbe ? "ADB responded. Enable USB debugging and trust the computer on Android devices." : "ADB is not available to the app process.",
        installHint: "Install Google.PlatformTools with winget, then reopen the app if PATH changed."
      },
      {
        id: "libimobiledevice",
        label: "libimobiledevice + Apple Mobile Device Support",
        command: "idevice_id",
        available: iosProbe !== null,
        path: findMobileCommand("idevice_id"),
        detail: iosProbe ? "iOS device tooling responded. Unlock the iPhone and trust this computer if no device appears." : "iOS tooling or Apple Mobile Device service is not available.",
        installHint: "Install Apple.AppleMobileDeviceSupport and place libimobiledevice binaries under .tools/mobile."
      }
    ];
  }

  private async detectHostUsbDevices(): Promise<MobileHostUsbDevice[]> {
    if (process.platform !== "win32") {
      return [];
    }
    const script = [
      "Get-PnpDevice -PresentOnly",
      "Where-Object { $_.FriendlyName -match 'Apple|iPhone|Android|ADB|Pixel|OnePlus|Motorola|Galaxy' -or $_.InstanceId -match 'VID_05AC|VID_18D1|VID_04E8' }",
      "Select-Object FriendlyName,Status",
      "ConvertTo-Json -Compress"
    ].join(" | ");
    const result = await this.tryRun("powershell.exe", ["-NoProfile", "-Command", script]);
    if (!result?.stdout.trim()) {
      return [];
    }
    return parseHostUsbDevices(result.stdout);
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

function runFixedCommand(command: string, args: readonly string[], options: { readonly timeoutMs: number; readonly allowPartialOnTimeout?: boolean }) {
  return new Promise<{ readonly stdout: string; readonly stderr: string }>((resolve, reject) => {
    execFile(resolveMobileCommand(command), [...args], { timeout: options.timeoutMs, shell: false, maxBuffer: 24 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        if (options.allowPartialOnTimeout && (stdout.trim() || stderr.trim())) {
          resolve({ stdout: `${stdout}\n[collector stopped after ${options.timeoutMs}ms]`, stderr });
          return;
        }
        reject(error instanceof Error ? error : new Error("Mobile command failed"));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function buildCollectionRecipes(platform: MobileCollectRequest["platform"], deviceId: string, dataTypeId: string): MobileCommandRecipe[] {
  if (platform === "android") {
    return buildAndroidRecipes(deviceId, dataTypeId);
  }
  return buildIosRecipes(deviceId, dataTypeId);
}

function buildAndroidRecipes(deviceId: string, dataTypeId: string): MobileCommandRecipe[] {
  const adb = (label: string, args: readonly string[], timeoutMs = 10_000): MobileCommandRecipe => ({
    label,
    command: "adb",
    args: ["-s", deviceId, ...args],
    timeoutMs
  });
  const shell = (label: string, args: readonly string[], timeoutMs = 10_000): MobileCommandRecipe =>
    adb(label, ["shell", ...args], timeoutMs);
  switch (dataTypeId) {
    case "android-device-info":
      return [
        shell("getprop", ["getprop"]),
        shell("settings secure android_id", ["settings", "get", "secure", "android_id"])
      ];
    case "android-packages":
      return [shell("installed packages", ["pm", "list", "packages", "-f"], 20_000)];
    case "android-battery":
      return [shell("battery", ["dumpsys", "battery"])];
    case "android-network":
      return [
        shell("ip addr", ["ip", "addr"]),
        shell("ip route", ["ip", "route"]),
        shell("wifi state", ["dumpsys", "wifi"], 15_000)
      ];
    case "android-storage":
      return [
        shell("df", ["df", "-h"]),
        shell("mount", ["mount"])
      ];
    case "android-processes":
      return [shell("process table", ["ps", "-A"], 15_000)];
    case "android-settings":
      return [
        shell("settings secure", ["settings", "list", "secure"]),
        shell("settings global", ["settings", "list", "global"]),
        shell("settings system", ["settings", "list", "system"])
      ];
    case "android-logcat":
      return [adb("logcat tail", ["logcat", "-d", "-t", "400"], 20_000)];
    case "android-bugreport":
      return [shell("dumpsys snapshot", ["dumpsys"], 30_000)];
    default:
      return [];
  }
}

function buildIosRecipes(deviceId: string, dataTypeId: string): MobileCommandRecipe[] {
  const ios = (label: string, command: string, args: readonly string[], timeoutMs = 10_000, allowPartialOnTimeout = false): MobileCommandRecipe => ({
    label,
    command,
    args,
    timeoutMs,
    allowPartialOnTimeout
  });
  switch (dataTypeId) {
    case "ios-pairing-status":
      return [ios("pair validation", "idevicepair", ["-u", deviceId, "validate"])];
    case "ios-device-info":
      return [ios("device info", "ideviceinfo", ["-u", deviceId], 15_000)];
    case "ios-device-name-date":
      return [
        ios("device name", "idevicename", ["-u", deviceId]),
        ios("device date", "idevicedate", ["-u", deviceId])
      ];
    case "ios-apps":
      return [ios("installed apps", "ideviceinstaller", ["-u", deviceId, "-l"], 25_000)];
    case "ios-diagnostics":
      return [ios("diagnostics", "idevicediagnostics", ["-u", deviceId, "diagnostics", "All"], 20_000)];
    case "ios-syslog":
      return [ios("syslog sample", "idevicesyslog", ["-u", deviceId], 5_000, true)];
    default:
      return [];
  }
}

function formatMobileSection(label: string, text: string): string {
  return [`## ${label}`, text.trim() || "(no output)"].join("\n");
}

function summarizeCollection(label: string, stdout: string, stderr: string): string {
  const lineCount = stdout ? stdout.split(/\r?\n/).filter(Boolean).length : 0;
  if (lineCount > 0) {
    return `${label}: captured ${lineCount} output line${lineCount === 1 ? "" : "s"}.`;
  }
  return stderr ? `${label}: no usable output; review error details.` : `${label}: no output returned.`;
}

function parseHostUsbDevices(stdout: string): MobileHostUsbDevice[] {
  try {
    const parsed: unknown = JSON.parse(stdout);
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows
      .map((row) => {
        if (!row || typeof row !== "object") {
          return null;
        }
        const record = row as { readonly FriendlyName?: unknown; readonly Status?: unknown };
        if (typeof record.FriendlyName !== "string" || typeof record.Status !== "string") {
          return null;
        }
        const device = {
          label: record.FriendlyName,
          status: record.Status
        };
        if (/apple|iphone/i.test(record.FriendlyName)) {
          return { ...device, platformHint: "ios" as const };
        }
        if (/android|adb|pixel|oneplus|motorola|galaxy/i.test(record.FriendlyName)) {
          return { ...device, platformHint: "android" as const };
        }
        return device;
      })
      .filter((device): device is MobileHostUsbDevice => device !== null);
  } catch {
    return [];
  }
}

function resolveMobileCommand(command: string): string {
  return findMobileCommand(command) ?? command;
}

function findMobileCommand(command: string): string | undefined {
  const executable = process.platform === "win32" && !command.endsWith(".exe") ? `${command}.exe` : command;
  const candidates = [
    ...pathCommandCandidates(executable),
    ...localMobileToolCandidates(executable),
    ...winGetPlatformToolCandidates(executable)
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

function localMobileToolCandidates(executable: string): string[] {
  const roots = [
    process.env.REACHER_MOBILE_TOOLS_DIR,
    resolve(process.cwd(), ".tools", "mobile"),
    process.env.INIT_CWD ? resolve(process.env.INIT_CWD, ".tools", "mobile") : undefined,
    process.argv[1] ? resolve(dirname(process.argv[1]), "..", "..", ".tools", "mobile") : undefined,
    process.argv[1] ? resolve(dirname(process.argv[1]), "..", ".tools", "mobile") : undefined,
    resolve(dirname(process.execPath), ".tools", "mobile")
  ].filter((root): root is string => Boolean(root));
  return roots.flatMap((root) => [
    join(root, executable),
    ...safeChildDirectories(root).flatMap((child) => [
      join(root, child, executable),
      ...safeChildDirectories(join(root, child)).map((grandchild) => join(root, child, grandchild, executable))
    ])
  ]);
}

function pathCommandCandidates(executable: string): string[] {
  const pathValue = process.env.PATH ?? process.env.Path ?? "";
  return pathValue
    .split(delimiter)
    .filter(Boolean)
    .map((entry) => join(entry, executable));
}

function winGetPlatformToolCandidates(executable: string): string[] {
  if (process.platform !== "win32" || executable.toLowerCase() !== "adb.exe") {
    return [];
  }
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) {
    return [];
  }
  const packageRoot = join(localAppData, "Microsoft", "WinGet", "Packages");
  return safeChildDirectories(packageRoot)
    .filter((child) => child.startsWith("Google.PlatformTools"))
    .map((child) => join(packageRoot, child, "platform-tools", executable));
}

function safeChildDirectories(root: string): string[] {
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
      .reverse();
  } catch {
    return [];
  }
}
