/**
 * MobileView shows what a trusted phone can expose before asking main to probe
 * USB devices. If phone data categories were hidden behind a single button,
 * users could collect sensitive inventory without seeing the scope first.
 *
 * The device is drawn as a modern handset so the route reads like a phone
 * console: a lock screen carries the connection traffic-light and a themed
 * wallpaper, and each pullable category is a labelled card with its own
 * available/blocked light. Nothing here executes a device command — it previews
 * scope and reflects what a detect pass reported.
 */
import { BatteryFull, RefreshCw, ShieldCheck, Signal, Smartphone, Wifi } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { MobileDevice, MobilePlatform, MobileProfilesResponse } from "../../shared/schemas/mobile";
import { useReacherClient } from "../hooks/use-reacher-client";

type ConnectionLevel = "connected" | "error" | "none";

export function MobileView() {
  const { invoke } = useReacherClient();
  const [profiles, setProfiles] = useState<MobileProfilesResponse["profiles"]>([]);
  const [devices, setDevices] = useState<MobileDevice[]>([]);
  const [unavailableTools, setUnavailableTools] = useState<string[]>([]);
  const [status, setStatus] = useState("Mobile inventory ready");
  const [loadingLabel, setLoadingLabel] = useState("Loading mobile profiles");
  const [detectError, setDetectError] = useState(false);
  const [autoDetect, setAutoDetect] = useState(true);
  const [lastDetectTs, setLastDetectTs] = useState<number | null>(null);

  const refreshProfiles = useCallback(async () => {
    setLoadingLabel("Loading mobile profiles");
    const result = await invoke("mobile:profiles", {});
    if (!result.ok) {
      setStatus(result.error.message);
      setLoadingLabel("");
      return;
    }
    setProfiles(result.value.profiles);
    setLoadingLabel("");
  }, [invoke]);

  const detectDevices = useCallback(
    async (silent: boolean): Promise<void> => {
      if (!silent) {
        setLoadingLabel("Detecting mobile devices");
        setStatus("Checking attached devices");
      }
      const result = await invoke("mobile:detect", {});
      if (!result.ok) {
        setDetectError(true);
        setStatus(result.error.message);
        setLoadingLabel("");
        return;
      }
      setDetectError(false);
      setDevices(result.value.devices);
      setUnavailableTools(result.value.unavailableTools);
      setLastDetectTs(Date.now());
      setStatus(
        result.value.devices.length > 0
          ? `Collected ${result.value.devices.length} trusted device${result.value.devices.length === 1 ? "" : "s"}`
          : "No trusted device attached"
      );
      setLoadingLabel("");
    },
    [invoke]
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshProfiles();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refreshProfiles]);

  // Auto-collect on plug-in: while enabled, quietly re-run detect so a phone that
  // is trusted after the page opens still lands in the console without a click.
  useEffect(() => {
    if (!autoDetect) {
      return;
    }
    // Kick the first detect on a timer, not synchronously, so the effect does not
    // setState during commit; the interval then keeps polling for a plug-in.
    const initial = window.setTimeout(() => void detectDevices(true), 0);
    const interval = window.setInterval(() => void detectDevices(true), 5000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [autoDetect, detectDevices]);

  const level: ConnectionLevel = detectError ? "error" : devices.length > 0 ? "connected" : "none";
  const activeDevice = devices[0] ?? null;
  const collectedCategories = useMemo(() => devices.reduce((total, device) => total + device.dataTypes.length, 0), [devices]);

  return (
    <section className="route-surface" aria-labelledby="mobile-title">
      <header className="route-header">
        <h1 className="route-title" id="mobile-title">
          Mobile
        </h1>
        <p className="route-summary">Plug in a phone you own, trust it on the device, and preview what OSINT data it can expose — no command runs from here.</p>
      </header>

      <div className="section-title-row section-title-row-wide">
        <span className="status-text" role="status">
          {status}
        </span>
        <label className="mobile-auto-toggle">
          <input type="checkbox" checked={autoDetect} onChange={(event) => setAutoDetect(event.currentTarget.checked)} />
          Auto-detect on plug-in
        </label>
        <button className="icon-button" type="button" aria-label="Detect mobile devices" title="Detect now" onClick={() => void detectDevices(false)}>
          <RefreshCw size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="mobile-stage">
        <Handset level={level} device={activeDevice} collected={collectedCategories} lastDetectTs={lastDetectTs} />

        <div className="mobile-detail-column">
          <section className="console-panel mobile-panel">
            <div className="section-title-row section-title-row-wide">
              <h2 className="section-title">Connected devices</h2>
              <span className={`status-dot ${levelDotClass(level)}`} aria-hidden="true" />
            </div>
            <div className="table-list">
              {devices.map((device) => (
                <div className="mobile-device-row" key={`${device.platform}-${device.id}`}>
                  <span className={`status-dot ${device.connected ? "status-dot-verified" : "status-dot-untested"}`} aria-hidden="true" />
                  <Smartphone size={18} aria-hidden="true" />
                  <div>
                    <strong>{device.label}</strong>
                    <span className="status-text">
                      {platformLabel(device.platform)} · {device.dataTypes.length} categor{device.dataTypes.length === 1 ? "y" : "ies"} collected
                    </span>
                  </div>
                </div>
              ))}
              {devices.length === 0 ? <p className="status-text">No trusted devices detected yet. Plug in a phone and tap “Trust”.</p> : null}
              {unavailableTools.length > 0 ? (
                <p className="mobile-missing-tools">
                  <ShieldCheck size={14} aria-hidden="true" /> Missing bridge tools: {unavailableTools.join(", ")}
                </p>
              ) : null}
            </div>
          </section>

          {profiles.map((profile) => {
            const toolReady = !unavailableTools.includes(profile.requiredTool);
            const platformConnected = devices.some((device) => device.platform === profile.platform);
            return (
              <section className="console-panel mobile-panel" key={profile.platform}>
                <div className="section-title-row section-title-row-wide">
                  <h2 className="section-title">{profile.label}</h2>
                  <span className={`status-pill ${toolReady ? "" : "is-blocked"}`}>{profile.requiredTool}</span>
                </div>
                <div className="mobile-category-grid">
                  {profile.dataTypes.map((dataType) => {
                    const categoryLevel: ConnectionLevel = !toolReady ? "error" : platformConnected ? "connected" : "none";
                    return (
                      <article className="mobile-category-card" key={dataType.id}>
                        <div className="mobile-category-head">
                          <span className={`status-dot ${levelDotClass(categoryLevel)}`} aria-hidden="true" />
                          <strong>{dataType.label}</strong>
                          <span className={`sensitivity-chip sensitivity-${dataType.sensitivity}`}>{dataType.sensitivity}</span>
                        </div>
                        <p className="mobile-category-desc">{dataType.description}</p>
                        <code className="mobile-category-command">{dataType.commandPreview.join(" ")}</code>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      {loadingLabel ? <div className="route-loading" role="status">{loadingLabel}</div> : null}
    </section>
  );
}

/**
 * The handset: a rounded frame with a Dynamic-Island cutout and a lock screen.
 * The wallpaper is a themed gradient (a real device wallpaper needs device I/O we
 * do not have here), and the traffic-light plus device name make the connection
 * state readable at a glance.
 */
function Handset(props: { readonly level: ConnectionLevel; readonly device: MobileDevice | null; readonly collected: number; readonly lastDetectTs: number | null }) {
  const wallpaperClass = props.device
    ? props.device.platform === "ios"
      ? "mobile-wallpaper-ios"
      : "mobile-wallpaper-android"
    : "mobile-wallpaper-idle";
  const clock = useMemo(
    () => (props.lastDetectTs ? new Date(props.lastDetectTs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--"),
    [props.lastDetectTs]
  );

  return (
    <div className="mobile-handset-wrap">
      <div className="iphone" role="img" aria-label={`Phone status: ${connectionLabel(props.level)}`}>
        <span className="iphone-btn iphone-btn-silent" aria-hidden="true" />
        <span className="iphone-btn iphone-btn-up" aria-hidden="true" />
        <span className="iphone-btn iphone-btn-down" aria-hidden="true" />
        <span className="iphone-btn iphone-btn-power" aria-hidden="true" />
        <div className={`iphone-screen ${wallpaperClass}`}>
          <div className="iphone-statusbar">
            <span>{clock}</span>
            <span className="iphone-statusbar-icons">
              <Signal size={12} aria-hidden="true" />
              <Wifi size={12} aria-hidden="true" />
              <BatteryFull size={14} aria-hidden="true" />
            </span>
          </div>
          <div className="iphone-island" aria-hidden="true" />
          <div className="iphone-lockscreen">
            <span className={`mobile-signal-light ${levelDotClass(props.level)}`} aria-hidden="true" />
            <span className="iphone-lock-status">{connectionLabel(props.level)}</span>
            <strong className="iphone-lock-device">{props.device ? props.device.label : "No device"}</strong>
            <span className="iphone-lock-sub">
              {props.device ? `${platformLabel(props.device.platform)} · ${props.collected} categories collected` : "Plug in & trust a phone"}
            </span>
          </div>
          <div className="iphone-lockbar" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

function levelDotClass(level: ConnectionLevel): string {
  if (level === "connected") {
    return "status-dot-verified";
  }
  if (level === "error") {
    return "status-dot-candidate";
  }
  return "status-dot-error";
}

function connectionLabel(level: ConnectionLevel): string {
  if (level === "connected") {
    return "Connected";
  }
  if (level === "error") {
    return "Attention needed";
  }
  return "No device";
}

function platformLabel(platform: MobilePlatform): string {
  return platform === "ios" ? "iOS" : "Android";
}
