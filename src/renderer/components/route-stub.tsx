/**
 * Route stubs are real surfaces instead of placeholder text so Phase 0 proves
 * that navigation, layout, and IPC can coexist before feature work begins. If
 * stubs were inert labels, later phases would discover shell bugs while adding
 * product logic.
 */
import { SatelliteDish } from "lucide-react";
import { useState } from "react";
import { invokeReacher } from "../ipc-client";
import type { NavigationRoute } from "../navigation";

interface RouteStubProps {
  readonly route: NavigationRoute;
}

export function RouteStub({ route }: RouteStubProps) {
  const [status, setStatus] = useState("Ready");

  async function recordStubAuditEvent(): Promise<void> {
    const result = await invokeReacher("system:ping", { nonce: route.id });
    setStatus(result.ok ? "Audit event recorded" : result.error.message);
  }

  return (
    <section className="route-surface" aria-labelledby={`${route.id}-title`}>
      <header className="route-header">
        <h1 className="route-title" id={`${route.id}-title`}>
          {route.label}
        </h1>
        <p className="route-summary">{route.summary}</p>
      </header>
      <div className="console-panel">
        <p className="console-line">surface:{route.id} status:stub</p>
      </div>
      <div className="action-row">
        <button className="action-button" type="button" onClick={() => void recordStubAuditEvent()}>
          <SatelliteDish size={16} aria-hidden="true" />
          Record stub action
        </button>
        <span className="status-text" role="status">
          {status}
        </span>
      </div>
    </section>
  );
}
