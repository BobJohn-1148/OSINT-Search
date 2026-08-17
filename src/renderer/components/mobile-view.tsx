/**
 * MobileView shows what a trusted phone can expose before asking main to probe
 * USB devices. If phone data categories were hidden behind a single button,
 * users could collect sensitive inventory without seeing the scope first.
 */
import {
  AlertTriangle,
  AppWindow,
  BatteryCharging,
  Bug,
  Camera,
  CheckCircle2,
  Copy,
  DatabaseZap,
  FileArchive,
  FileText,
  HardDrive,
  Info,
  ListTree,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  TerminalSquare,
  Usb,
  Wrench
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { MobileCollectionResult, MobileDevice, MobileDetectResponse, MobileProfilesResponse } from "../../shared/schemas/mobile";
import { useReacherClient } from "../hooks/use-reacher-client";

const mobileSidebarItems: readonly { label: string; Icon: LucideIcon }[] = [
  { label: "Information", Icon: Info },
  { label: "Photos", Icon: Camera },
  { label: "Apps", Icon: AppWindow },
  { label: "Files", Icon: HardDrive },
  { label: "Crash Logs", Icon: Bug },
  { label: "Syslog", Icon: TerminalSquare },
  { label: "Backup", Icon: FileArchive },
  { label: "More", Icon: Wrench }
];

export function MobileView() {
  const { invoke } = useReacherClient();
  const [profiles, setProfiles] = useState<MobileProfilesResponse["profiles"]>([]);
  const [devices, setDevices] = useState<MobileDevice[]>([]);
  const [unavailableTools, setUnavailableTools] = useState<string[]>([]);
  const [toolStatus, setToolStatus] = useState<NonNullable<MobileDetectResponse["toolStatus"]>>([]);
  const [hostUsbDevices, setHostUsbDevices] = useState<NonNullable<MobileDetectResponse["hostUsbDevices"]>>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [collectionResults, setCollectionResults] = useState<MobileCollectionResult[]>([]);
  const [collecting, setCollecting] = useState(false);
  const [status, setStatus] = useState("Mobile inventory ready");
  const autoCollectedDeviceId = useRef("");

  const selectedDevice = useMemo(
    () => devices.find((device) => device.id === selectedDeviceId) ?? null,
    [devices, selectedDeviceId]
  );
  const visibleToolStatus = useMemo(
    () => toolStatus.filter((tool) => !selectedDevice || (selectedDevice.platform === "ios" ? tool.id === "libimobiledevice" : tool.id === "adb")),
    [selectedDevice, toolStatus]
  );
  const visibleUnavailableTools = useMemo(
    () => unavailableTools.filter((tool) => !selectedDevice || (selectedDevice.platform === "ios" ? tool !== "adb" : tool !== "libimobiledevice")),
    [selectedDevice, unavailableTools]
  );
  const latestCollection = firstItem(collectionResults);

  const refreshProfiles = useCallback(async () => {
    const result = await invoke("mobile:profiles", {});
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setProfiles(result.value.profiles);
  }, [invoke]);

  const detectDevices = useCallback(async (): Promise<void> => {
    setStatus("Checking attached devices");
    const result = await invoke("mobile:detect", {});
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setDevices(result.value.devices);
    const firstDevice = firstItem(result.value.devices);
    setSelectedDeviceId((current) => {
      if (current && result.value.devices.some((device) => device.id === current)) {
        return current;
      }
      return firstDevice ? firstDevice.id : "";
    });
    setUnavailableTools(result.value.unavailableTools);
    setToolStatus(result.value.toolStatus ?? []);
    setHostUsbDevices(result.value.hostUsbDevices ?? []);
    setStatus(buildDetectionStatus(result.value));
  }, [invoke]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshProfiles();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refreshProfiles]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void detectDevices();
    }, 120);
    return () => window.clearTimeout(timeoutId);
  }, [detectDevices]);

  const collectDevice = useCallback(async (dataTypeIds?: readonly string[]): Promise<void> => {
    if (!selectedDevice) {
      setStatus("Detect and select a trusted phone before collecting data");
      return;
    }
    setCollecting(true);
    setStatus(dataTypeIds?.length === 1 ? "Collecting selected mobile category" : "Collecting full mobile snapshot");
    const result = await invoke("mobile:collect", {
      deviceId: selectedDevice.id,
      platform: selectedDevice.platform,
      dataTypeIds: dataTypeIds ? [...dataTypeIds] : undefined
    });
    setCollecting(false);
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setCollectionResults((current) => mergeCollectionResults(current, result.value.results));
    const passed = result.value.results.filter((item) => item.status === "passed").length;
    const skipped = result.value.results.filter((item) => item.status === "skipped").length;
    setStatus(`Collected ${passed} mobile section${passed === 1 ? "" : "s"}${skipped ? ` / skipped ${skipped}` : ""}`);
  }, [invoke, selectedDevice]);

  useEffect(() => {
    if (!selectedDevice) {
      autoCollectedDeviceId.current = "";
      return;
    }
    if (collecting || autoCollectedDeviceId.current === selectedDevice.id) {
      return;
    }
    autoCollectedDeviceId.current = selectedDevice.id;
    void collectDevice();
  }, [collectDevice, collecting, selectedDevice]);

  async function copyCollection(result: MobileCollectionResult, mode: "formatted" | "raw"): Promise<void> {
    const text = mode === "formatted" ? collectionToMarkdown(result) : result.stdout || result.stderr || result.summary;
    await copyToClipboard(text);
    setStatus(mode === "formatted" ? `Copied formatted ${result.label} output` : `Copied raw ${result.label} output`);
  }

  async function copyFullReport(): Promise<void> {
    await copyToClipboard(collectionResults.map(collectionToMarkdown).join("\n\n---\n\n"));
    setStatus("Copied formatted mobile report");
  }

  const overview = buildDeviceOverview(selectedDevice, collectionResults);
  const platformLabel = selectedDevice?.platform === "ios" ? "Apple iOS" : selectedDevice?.platform === "android" ? "Android" : "No device";
  const toolboxItems = mobileToolboxItems(selectedDevice, profiles, collectionResults);

  return (
    <section className="mobile-3u-workspace" aria-labelledby="mobile-title">
      <div className="mobile-3u-topbar">
        <div className="mobile-3u-brand">
          <span className="mobile-3u-logo">R</span>
          <div>
            <h1 id="mobile-title">Mobile</h1>
            <small>Reacher trusted-device forensic toolbox</small>
          </div>
        </div>
        <nav className="mobile-3u-tabs" aria-label="Mobile sections">
          <button className="is-active" type="button">Device</button>
          <button type="button">Toolbox</button>
          <button type="button">Apps</button>
          <button type="button">Files</button>
          <button type="button">Reports</button>
        </nav>
        <div className="mobile-3u-actions">
          <button className="mobile-3u-icon-button" type="button" aria-label="Refresh phone detection" onClick={() => void detectDevices()}>
            <RefreshCw size={17} aria-hidden="true" />
          </button>
          <button className="mobile-3u-primary" type="button" disabled={!selectedDevice || collecting} onClick={() => void collectDevice()}>
            <DatabaseZap size={16} aria-hidden="true" />
            {collecting ? "Collecting" : "Quick Scan"}
          </button>
        </div>
      </div>

      <div className="mobile-3u-shell">
        <aside className="mobile-3u-sidebar" aria-label="Connected device menu">
          <div className="mobile-3u-device-list">
            {devices.map((device) => (
              <button
                className={device.id === selectedDevice?.id ? "mobile-3u-device-button is-selected" : "mobile-3u-device-button"}
                key={`${device.platform}-${device.id}`}
                type="button"
                onClick={() => setSelectedDeviceId(device.id)}
              >
                <Smartphone size={18} aria-hidden="true" />
                <span>{device.label}</span>
                <small>{device.platform} / {device.dataTypes.length} tools</small>
              </button>
            ))}
            {devices.length === 0 ? (
              <div className="mobile-3u-empty-device">
                <Smartphone size={24} aria-hidden="true" />
                <strong>No trusted phone</strong>
                <small>Plug in, unlock, and trust this computer.</small>
              </div>
            ) : null}
          </div>

          <div className="mobile-3u-menu" role="list" aria-label="3uTools-style mobile menu">
            {mobileSidebarItems.map((item) => (
              <button className={item.label === "Information" ? "is-active" : ""} type="button" key={item.label}>
                <item.Icon size={17} aria-hidden="true" />
                {item.label}
              </button>
            ))}
          </div>

          <div className="mobile-3u-side-status">
            {hostUsbDevices.length > 0 ? (
              <div className="mobile-usb-hint">
                <Usb size={18} aria-hidden="true" />
                <div>
                  <strong>USB detected</strong>
                  <span className="status-text">{hostUsbDevices.map((device) => `${device.label} (${device.status})`).join(", ")}</span>
                </div>
              </div>
            ) : null}
            {visibleUnavailableTools.length > 0 ? <p className="status-text">Missing tools: {visibleUnavailableTools.join(", ")}</p> : null}
          </div>
        </aside>

        <main className="mobile-3u-main">
          <section className="mobile-3u-hero" aria-label="Mobile device overview">
            <div className="mobile-3u-phone-stage">
              <div className={`mobile-3u-phone ${selectedDevice?.platform === "android" ? "is-android" : ""}`} aria-hidden="true">
                <div className="mobile-3u-phone-speaker" />
                <div className="mobile-3u-phone-screen">
                  <span>{platformLabel}</span>
                  <strong>{overview.model}</strong>
                  <small>{overview.osVersion}</small>
                  <div className="mobile-3u-app-grid">
                    {Array.from({ length: 12 }).map((_, index) => <i key={index} />)}
                  </div>
                </div>
              </div>
              <div className="mobile-3u-phone-actions">
                <button type="button" disabled={!selectedDevice || collecting} onClick={() => void collectDevice()}>
                  Refresh
                </button>
                <button type="button" disabled={!selectedDevice || collecting} onClick={() => void collectDevice(["ios-device-name-date", "android-device-info"])}>
                  Reboot Info
                </button>
                <button type="button" disabled={!selectedDevice || collecting} onClick={() => void collectDevice(["ios-screenshot"])}>
                  Screenshot
                </button>
              </div>
            </div>

            <div className="mobile-3u-summary">
              <div className="mobile-3u-device-heading">
                <div>
                  <p className="status-text" role="status">{status}</p>
                  <h2>{selectedDevice?.label ?? "Connect a trusted phone"}</h2>
                </div>
                <span className={collecting ? "status-pill status-pill-blue" : selectedDevice ? "status-pill status-pill-green" : "status-pill"}>
                  {collecting ? "running" : selectedDevice ? "trusted" : "waiting"}
                </span>
              </div>

              <div className="mobile-3u-info-grid">
                <InfoField label="OS Version" value={overview.osVersion} />
                <InfoField label="Serial Number" value={overview.serial} />
                <InfoField label="UDID / Device ID" value={overview.udid} />
                <InfoField label="Model Identifier" value={overview.model} />
                <InfoField label="Device Name" value={overview.deviceName} />
                <InfoField label="Activation / Trust" value={selectedDevice ? "Trusted locally" : "Not connected"} />
                <InfoField label="Battery" value={overview.battery} />
                <InfoField label="Storage" value={overview.storage} />
              </div>
            </div>

            <div className="mobile-3u-health">
              <HealthCard icon={<BatteryCharging size={18} aria-hidden="true" />} label="Battery" value={overview.battery} detail="Battery fields are parsed when exposed by the platform." />
              <HealthCard icon={<HardDrive size={18} aria-hidden="true" />} label="Storage" value={overview.storage} detail="Filesystem/storage snapshot from safe local collectors." />
              <HealthCard icon={<AppWindow size={18} aria-hidden="true" />} label="Apps" value={overview.apps} detail="Installed application inventory where protocol access allows it." />
              <HealthCard icon={<ShieldCheck size={18} aria-hidden="true" />} label="Tools" value={`${visibleToolStatus.filter((tool) => tool.available).length}/${visibleToolStatus.length || 0}`} detail="Local forensic command dependencies." />
            </div>
          </section>

          <section className="mobile-3u-toolbox" aria-labelledby="mobile-toolbox-title">
            <div className="mobile-3u-section-title">
              <h2 id="mobile-toolbox-title">Toolbox</h2>
              <small>3uTools-style quick actions mapped to Reacher’s local collectors</small>
            </div>
            <div className="mobile-3u-tool-grid">
              {toolboxItems.map((item) => (
                <button
                  className={item.enabled ? "mobile-3u-tool-tile" : "mobile-3u-tool-tile is-disabled"}
                  type="button"
                  key={item.label}
                  disabled={!item.enabled || collecting}
                  onClick={() => void collectDevice(item.dataTypeIds)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  <small>{item.description}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="mobile-3u-tools-status" aria-label="Local mobile tool setup">
            {visibleToolStatus.map((tool) => (
              <div className="mobile-3u-tool-status" key={tool.id}>
                {tool.available ? <CheckCircle2 size={18} aria-hidden="true" /> : <AlertTriangle size={18} aria-hidden="true" />}
                <div>
                  <strong>{tool.label}</strong>
                  <span>{tool.available ? "available" : "needs setup"} / {tool.command}</span>
                  {tool.path ? <code>{tool.path}</code> : <small>{tool.installHint}</small>}
                </div>
              </div>
            ))}
          </section>

          <section className="console-panel mobile-panel mobile-results-panel">
          <div className="panel-heading-row">
            <div>
              <h2 className="section-title">Collected output</h2>
              <p className="status-text">Formatted for review first, with raw command output tucked behind each section.</p>
            </div>
            <button className="action-button" type="button" disabled={collectionResults.length === 0} onClick={() => void copyFullReport()}>
              <FileText size={16} aria-hidden="true" />
              Copy formatted report
            </button>
          </div>
          {collectionResults.length === 0 ? <p className="status-text">No mobile data collected yet. Select a trusted device and run a snapshot.</p> : null}
          <div className="mobile-result-list">
            {collectionResults.map((result) => (
              <details className="mobile-result-card" key={result.dataTypeId} open={result.status !== "passed" || result.dataTypeId === latestCollection?.dataTypeId}>
                <summary>
                  <span>
                    <strong>{result.label}</strong>
                    <small>{result.summary}</small>
                  </span>
                  <span className={`status-pill ${result.status === "passed" ? "status-pill-green" : result.status === "skipped" ? "status-pill-blue" : "status-pill-red"}`}>
                    {result.status}
                  </span>
                </summary>
                <div className="mobile-result-meta">
                  <span>{result.sensitivity}</span>
                  <span>{result.commandPreview.join(" ")}</span>
                  <span>{new Date(result.completedTs).toLocaleString()}</span>
                </div>
                <div className="mobile-result-actions">
                  <button className="action-button" type="button" onClick={() => void copyCollection(result, "formatted")}>
                    <Copy size={15} aria-hidden="true" />
                    Copy formatted
                  </button>
                  <button className="action-button" type="button" onClick={() => void copyCollection(result, "raw")}>
                    <TerminalSquare size={15} aria-hidden="true" />
                    Copy raw
                  </button>
                </div>
                {result.stderr ? <pre className="mobile-result-error">{result.stderr}</pre> : null}
                <FormattedMobileOutput result={result} />
                <details className="mobile-raw-toggle">
                  <summary>Raw command output</summary>
                  <pre className="tools-output mobile-result-output">{result.stdout || "No stdout captured."}</pre>
                </details>
              </details>
            ))}
          </div>
        </section>
        </main>
      </div>
    </section>
  );
}

function InfoField(props: { readonly label: string; readonly value: string }) {
  return (
    <div className="mobile-3u-info-field">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function HealthCard(props: { readonly icon: ReactNode; readonly label: string; readonly value: string; readonly detail: string }) {
  return (
    <div className="mobile-3u-health-card">
      {props.icon}
      <div>
        <span>{props.label}</span>
        <strong>{props.value}</strong>
        <small>{props.detail}</small>
      </div>
    </div>
  );
}

interface DeviceOverview {
  readonly osVersion: string;
  readonly serial: string;
  readonly udid: string;
  readonly model: string;
  readonly deviceName: string;
  readonly battery: string;
  readonly storage: string;
  readonly apps: string;
}

interface MobileToolboxItem {
  readonly label: string;
  readonly description: string;
  readonly icon: ReactNode;
  readonly enabled: boolean;
  readonly dataTypeIds: readonly string[];
}

function buildDeviceOverview(device: MobileDevice | null, results: readonly MobileCollectionResult[]): DeviceOverview {
  const deviceInfo = results.find((result) => result.dataTypeId.endsWith("device-info"));
  const battery = results.find((result) => result.dataTypeId.includes("battery"));
  const storage = results.find((result) => result.dataTypeId.includes("storage"));
  const apps = results.find((result) => result.dataTypeId.includes("apps") || result.dataTypeId.includes("packages"));
  const infoRows = parseKeyValueRows(deviceInfo?.stdout ?? "");
  const batteryRows = parseKeyValueRows(battery?.stdout ?? "");
  const storageLines = (storage?.stdout ?? "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  const appLines = (apps?.stdout ?? "").split(/\r?\n/).filter((line) => line.trim().length > 0);

  return {
    osVersion: firstField(infoRows, ["ProductVersion", "ro.build.version.release", "ro.build.version.sdk", "BuildVersion"]) ?? "--",
    serial: firstField(infoRows, ["SerialNumber", "ro.serialno", "ro.boot.serialno", "Serial"]) ?? "--",
    udid: firstField(infoRows, ["UniqueDeviceID", "udid", "DeviceIdentifier"]) ?? device?.id ?? "--",
    model: firstField(infoRows, ["ProductType", "ModelNumber", "HardwareModel", "ro.product.model", "ro.product.device"]) ?? devicePlatformModel(device),
    deviceName: firstField(infoRows, ["DeviceName", "UserAssignedDeviceName", "ro.product.name", "ro.product.manufacturer"]) ?? device?.label ?? "--",
    battery: firstField(batteryRows, ["BatteryCurrentCapacity", "BatteryIsCharging", "level", "status"]) ?? (battery ? "captured" : "--"),
    storage: storageLines.length > 1 ? `${storageLines.length - 1} volumes` : storage ? "captured" : "--",
    apps: appLines.length > 0 ? `${appLines.length} apps` : apps ? "captured" : "--"
  };
}

function firstField(rows: readonly { readonly key: string; readonly value: string }[], names: readonly string[]): string | null {
  const loweredNames = names.map((name) => name.toLowerCase());
  const row = rows.find((candidate) => loweredNames.includes(candidate.key.toLowerCase()));
  const value = row?.value.trim();
  return value ?? null;
}

function devicePlatformModel(device: MobileDevice | null): string {
  if (!device) {
    return "--";
  }
  return device.platform === "ios" ? "iPhone / iPad" : "Android device";
}

function mobileToolboxItems(
  device: MobileDevice | null,
  profiles: MobileProfilesResponse["profiles"],
  results: readonly MobileCollectionResult[]
): MobileToolboxItem[] {
  const availableIds = new Set((device?.dataTypes ?? profiles.flatMap((profile) => profile.dataTypes)).map((dataType) => dataType.id));
  const hasResult = (ids: readonly string[]): boolean => ids.some((id) => results.some((result) => result.dataTypeId === id && result.status === "passed"));
  const enabled = (ids: readonly string[]): boolean => Boolean(device) && ids.some((id) => availableIds.has(id));
  const item = (
    label: string,
    description: string,
    icon: ReactNode,
    dataTypeIds: readonly string[],
    forceDisabled = false
  ): MobileToolboxItem => ({
    label,
    description: hasResult(dataTypeIds) ? `${description} / captured` : description,
    icon,
    enabled: !forceDisabled && enabled(dataTypeIds),
    dataTypeIds
  });

  return [
    item("Verification Report", "Device identity, trust, model, and diagnostics", <ShieldCheck size={24} aria-hidden="true" />, [
      "ios-pairing-status",
      "ios-device-info",
      "ios-diagnostics",
      "android-device-info",
      "android-settings"
    ]),
    item("Apps", "Installed app/package inventory", <AppWindow size={24} aria-hidden="true" />, ["ios-apps", "android-packages"]),
    item("Battery", "Battery and charging state", <BatteryCharging size={24} aria-hidden="true" />, ["android-battery", "ios-device-info"]),
    item("Storage", "Filesystem and mounted-volume context", <HardDrive size={24} aria-hidden="true" />, ["android-storage", "ios-device-info"]),
    item("Screenshot", "Capture visible screen when supported", <Camera size={24} aria-hidden="true" />, ["ios-screenshot"]),
    item("Crash Logs", "Copy crash artifacts or bugreport data", <Bug size={24} aria-hidden="true" />, ["ios-crash-reports", "android-bugreport"]),
    item("Live Logs", "Live syslog or recent logcat", <TerminalSquare size={24} aria-hidden="true" />, ["ios-syslog", "android-logcat"]),
    item("Processes", "Running process snapshot", <ListTree size={24} aria-hidden="true" />, ["android-processes"]),
    item("Backup", "Structured local forensic report copy", <FileArchive size={24} aria-hidden="true" />, [
      "ios-device-info",
      "ios-apps",
      "ios-crash-reports",
      "android-device-info",
      "android-packages",
      "android-bugreport"
    ]),
    item("Smart Flash", "Not included: risky firmware flashing", <Wrench size={24} aria-hidden="true" />, [], true)
  ];
}

function FormattedMobileOutput(props: { readonly result: MobileCollectionResult }) {
  const sections = parseMobileSections(props.result.stdout);
  if (sections.length === 0) {
    return <p className="status-text">No formatted output was captured for this section.</p>;
  }
  return (
    <div className="mobile-formatted-output">
      {sections.map((section) => {
        const logRows = parseLogRows(section.body);
        const rows = parseKeyValueRows(section.body);
        const outputLines = section.body.split(/\r?\n/).filter(Boolean);
        return (
          <section className="mobile-output-section" key={section.title}>
            <div className="mobile-output-section-heading">
              <h3>{section.title}</h3>
              <span>{logRows.length > 0 ? `${logRows.length} log events` : rows.length > 0 ? `${rows.length} parsed fields` : `${outputLines.length} lines`}</span>
            </div>
            {logRows.length > 0 ? (
              <div className="mobile-log-table" role="table" aria-label={`${section.title} log events`}>
                <div className="mobile-log-row mobile-log-header" role="row">
                  <span role="columnheader">Time</span>
                  <span role="columnheader">Process</span>
                  <span role="columnheader">Level</span>
                  <span role="columnheader">Message</span>
                </div>
                {logRows.map((row, index) => (
                  <div className="mobile-log-row" role="row" key={`${section.title}-${row.timestamp}-${row.process}-${index}`}>
                    <span role="cell">{row.timestamp}</span>
                    <span role="cell">{row.pid ? `${row.process}[${row.pid}]` : row.process}</span>
                    <span role="cell">
                      <span className={`mobile-log-level mobile-log-level-${row.level.toLowerCase()}`}>{row.level}</span>
                    </span>
                    <span role="cell">{row.message}</span>
                  </div>
                ))}
              </div>
            ) : rows.length > 0 ? (
              <dl className="mobile-kv-grid mobile-scrollable-output">
                {rows.map((row) => (
                  <div key={`${section.title}-${row.key}-${row.value}`}>
                    <dt>{row.key}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <pre className="mobile-output-readable">{outputLines.join("\n") || "(no output)"}</pre>
            )}
          </section>
        );
      })}
    </div>
  );
}

function firstItem<T>(items: readonly T[]): T | null {
  for (const item of items) {
    return item;
  }
  return null;
}

function mergeCollectionResults(current: readonly MobileCollectionResult[], incoming: readonly MobileCollectionResult[]): MobileCollectionResult[] {
  const byId = new Map(current.map((result) => [result.dataTypeId, result]));
  for (const result of incoming) {
    byId.set(result.dataTypeId, result);
  }
  return [...byId.values()].sort((left, right) => right.completedTs.localeCompare(left.completedTs));
}

function buildDetectionStatus(result: MobileDetectResponse): string {
  if (result.devices.length > 0) {
    return `Detected ${result.devices.length} trusted device${result.devices.length === 1 ? "" : "s"}`;
  }
  if ((result.hostUsbDevices ?? []).length > 0) {
    return "Phone is plugged in, but no trusted device session is available yet";
  }
  return "No attached phone detected";
}

function parseMobileSections(stdout: string): { readonly title: string; readonly body: string }[] {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return [];
  }
  const sections: { readonly title: string; readonly body: string }[] = [];
  const matches = [...trimmed.matchAll(/^##\s+(.+)$/gm)];
  if (matches.length === 0) {
    return [{ title: "Output", body: trimmed }];
  }
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const title = match[1].trim();
    const bodyStart = match.index + match[0].length;
    const bodyEnd = index + 1 < matches.length ? matches[index + 1].index : trimmed.length;
    const body = trimmed.slice(bodyStart, bodyEnd).trim();
    sections.push({ title, body });
  }
  return sections;
}

function parseKeyValueRows(text: string): { readonly key: string; readonly value: string }[] {
  if (parseLogRows(text).length > 0) {
    return [];
  }
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => {
      const colon = /^([A-Za-z][^:]{0,79}):\s*(.+)$/.exec(line);
      if (colon) {
        return { key: colon[1].trim(), value: colon[2].trim() };
      }
      const bracketed = /^\[([^\]]{1,80})\]:\s*\[(.*)\]$/.exec(line);
      if (bracketed) {
        return { key: bracketed[1].trim(), value: bracketed[2].trim() };
      }
      const equals = /^([A-Za-z0-9_.-]{1,80})=(.+)$/.exec(line);
      if (equals) {
        return { key: equals[1].trim(), value: equals[2].trim() };
      }
      return null;
    })
    .filter((row): row is { readonly key: string; readonly value: string } => row !== null && row.value.length > 0);
}

interface LogRow {
  readonly timestamp: string;
  readonly process: string;
  readonly pid: string;
  readonly level: string;
  readonly message: string;
}

function parseLogRows(text: string): LogRow[] {
  const rows: LogRow[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    const parsed = parseIosSyslogLine(line) ?? parseAndroidLogcatLine(line) ?? parseGenericLogLine(line);
    if (parsed) {
      rows.push(parsed);
      continue;
    }
    const last = rows.at(-1);
    if (last && !line.startsWith("[")) {
      rows[rows.length - 1] = { ...last, message: `${last.message}\n${line}` };
    }
  }
  return rows.length >= 3 ? rows : [];
}

function parseIosSyslogLine(line: string): LogRow | null {
  const match = /^([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+([^\s:[\]]+)(?:\[(\d+)])?\s*(?:<([^>]+)>:?)?\s*(.*)$/.exec(line);
  if (!match) {
    return null;
  }
  return {
    timestamp: match[1],
    process: match[2],
    pid: match[3] || "",
    level: normalizeLogLevel(match[4] || "info"),
    message: match[5] || "(no message)"
  };
}

function parseAndroidLogcatLine(line: string): LogRow | null {
  const match = /^(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+)\s+\d+\s+(\d+)\s+([VDIWEF])\s+([^:]+):\s*(.*)$/.exec(line);
  if (!match) {
    return null;
  }
  return {
    timestamp: match[1],
    process: match[4].trim(),
    pid: match[2],
    level: normalizeLogLevel(match[3]),
    message: match[5] || "(no message)"
  };
}

function parseGenericLogLine(line: string): LogRow | null {
  const match = /^(\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+([^\s:[\]]+)(?:\[(\d+)])?\s*(?:<([^>]+)>:?)?\s*(.*)$/.exec(line);
  if (!match) {
    return null;
  }
  return {
    timestamp: match[1],
    process: match[2],
    pid: match[3] || "",
    level: normalizeLogLevel(match[4] || "info"),
    message: match[5] || "(no message)"
  };
}

function normalizeLogLevel(level: string): string {
  const normalized = level.trim().toLowerCase();
  if (normalized === "v") return "verbose";
  if (normalized === "d") return "debug";
  if (normalized === "i") return "info";
  if (normalized === "w") return "warning";
  if (normalized === "e") return "error";
  if (normalized === "f") return "fatal";
  if (normalized.includes("debug")) return "debug";
  if (normalized.includes("error")) return "error";
  if (normalized.includes("fault")) return "error";
  if (normalized.includes("warn")) return "warning";
  if (normalized.includes("notice")) return "notice";
  return normalized || "info";
}

function collectionToMarkdown(result: MobileCollectionResult): string {
  const sections = parseMobileSections(result.stdout);
  const lines = [
    `# ${result.label}`,
    "",
    `- Status: ${result.status}`,
    `- Sensitivity: ${result.sensitivity}`,
    `- Command: \`${result.commandPreview.join(" ")}\``,
    `- Completed: ${new Date(result.completedTs).toLocaleString()}`,
    `- Summary: ${result.summary}`
  ];
  if (result.stderr.trim()) {
    lines.push("", "## Errors", "", "```text", result.stderr.trim(), "```");
  }
  for (const section of sections) {
    const logs = parseLogRows(section.body);
    const rows = parseKeyValueRows(section.body);
    lines.push("", `## ${section.title}`, "");
    if (logs.length > 0) {
      lines.push("| Time | Process | Level | Message |", "| --- | --- | --- | --- |");
      for (const log of logs) {
        lines.push(`| ${escapeMarkdownTable(log.timestamp)} | ${escapeMarkdownTable(log.pid ? `${log.process}[${log.pid}]` : log.process)} | ${escapeMarkdownTable(log.level)} | ${escapeMarkdownTable(log.message)} |`);
      }
    } else if (rows.length > 0) {
      lines.push("| Field | Value |", "| --- | --- |");
      for (const row of rows) {
        lines.push(`| ${escapeMarkdownTable(row.key)} | ${escapeMarkdownTable(row.value)} |`);
      }
    } else {
      lines.push("```text", section.body || "(no output)", "```");
    }
  }
  return lines.join("\n");
}

function escapeMarkdownTable(value: string): string {
  return value.replaceAll("|", "\\|").replace(/\r?\n/g, " ");
}

async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
