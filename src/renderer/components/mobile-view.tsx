/**
 * MobileView shows what a trusted phone can expose before asking main to probe
 * USB devices. If phone data categories were hidden behind a single button,
 * users could collect sensitive inventory without seeing the scope first.
 */
import { RefreshCw, Smartphone } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { MobileDevice, MobileProfilesResponse } from "../../shared/schemas/mobile";
import { useReacherClient } from "../hooks/use-reacher-client";

export function MobileView() {
  const { invoke } = useReacherClient();
  const [profiles, setProfiles] = useState<MobileProfilesResponse["profiles"]>([]);
  const [devices, setDevices] = useState<MobileDevice[]>([]);
  const [unavailableTools, setUnavailableTools] = useState<string[]>([]);
  const [status, setStatus] = useState("Mobile inventory ready");

  const refreshProfiles = useCallback(async () => {
    const result = await invoke("mobile:profiles", {});
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setProfiles(result.value.profiles);
  }, [invoke]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshProfiles();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refreshProfiles]);

  async function detectDevices(): Promise<void> {
    setStatus("Checking attached devices");
    const result = await invoke("mobile:detect", {});
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setDevices(result.value.devices);
    setUnavailableTools(result.value.unavailableTools);
    setStatus(`Detected ${result.value.devices.length} trusted devices`);
  }

  return (
    <section className="route-surface" aria-labelledby="mobile-title">
      <header className="route-header">
        <h1 className="route-title" id="mobile-title">
          Mobile
        </h1>
        <p className="route-summary">Preview Android and Apple data categories available from a phone you plug in and trust locally.</p>
      </header>

      <div className="section-title-row">
        <span className="status-text" role="status">
          {status}
        </span>
        <button className="icon-button" type="button" aria-label="Detect mobile devices" onClick={() => void detectDevices()}>
          <RefreshCw size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="mobile-layout">
        <section className="console-panel mobile-panel">
          <h2 className="section-title">Connected devices</h2>
          <div className="table-list">
            {devices.map((device) => (
              <div className="mobile-device-row" key={`${device.platform}-${device.id}`}>
                <Smartphone size={18} aria-hidden="true" />
                <div>
                  <strong>{device.label}</strong>
                  <span className="status-text">
                    {device.platform} / categories:{device.dataTypes.length}
                  </span>
                </div>
              </div>
            ))}
            {devices.length === 0 ? <p className="status-text">No trusted devices detected yet.</p> : null}
            {unavailableTools.length > 0 ? <p className="status-text">Missing tools: {unavailableTools.join(", ")}</p> : null}
          </div>
        </section>

        {profiles.map((profile) => (
          <section className="console-panel mobile-panel" key={profile.platform}>
            <h2 className="section-title">{profile.label}</h2>
            <p className="status-text">Required tool: {profile.requiredTool}</p>
            <div className="table-list">
              {profile.dataTypes.map((dataType) => (
                <div className="mobile-data-row" key={dataType.id}>
                  <strong>{dataType.label}</strong>
                  <span className="status-text">
                    {dataType.sensitivity} / {dataType.commandPreview.join(" ")}
                  </span>
                  <span className="status-text">{dataType.description}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
