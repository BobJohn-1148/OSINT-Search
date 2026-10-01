/**
 * The preview page component, kept apart from the entry file so the entry can mount it without a component living next to
 * non-component code (Fast Refresh needs a module to export only components).
 *
 * Scenarios (?scenario=): full | partial | running | empty | many  (static, as before)
 *                         stream | burst                           (a deterministic live demo with Play / Restart)
 * Other parameters: ?frame=<px> constrains the width; ?autoplay=1 starts a live demo on load.
 * Everything shown is labelled Demo data; nothing here talks to a provider.
 */
import { useState, type CSSProperties } from "react";
import type { SourceStatus } from "../shared/types/search";
import { demoAssessment, demoLabel, demoManyObservations, demoObservations, demoRun, demoStatuses } from "./components/osint-results-demo";
import { burstScript, storyScript } from "./components/osint-results-demo-stream";
import { OsintResultsView } from "./components/osint-results-view";
import { useDemoPlayer } from "./components/use-demo-player";

const params = new URLSearchParams(window.location.search);
const scenario = params.get("scenario") ?? "full";
const frame = Number(params.get("frame")) || undefined;
const autoplay = params.get("autoplay") === "1";
const live = scenario === "stream" || scenario === "burst";
const storyFrames = storyScript();
const burstFrames = burstScript();

const bar: CSSProperties = { display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", margin: "0 0 12px" };
const logStyle: CSSProperties = { margin: "10px 0 0", padding: "0 0 0 18px", color: "var(--color-text-muted)", fontSize: "12px" };

export function Preview() {
  const [selected, setSelected] = useState<string | null>(scenario === "empty" || live ? null : "dns-01");
  const [reduced, setReduced] = useState(false);
  const player = useDemoPlayer(scenario === "burst" ? burstFrames : storyFrames, autoplay && live);
  const many = demoManyObservations();
  const statuses: readonly SourceStatus[] = live
    ? player.state.statuses
    : scenario === "many"
      ? many.statuses
      : scenario === "running"
        ? demoStatuses.slice(0, 2)
        : scenario === "empty"
          ? []
          : demoStatuses;
  const observations = live
    ? player.state.observations
    : scenario === "many"
      ? many.observations
      : scenario === "running"
        ? demoObservations.filter((item) => item.source === "dns-doh" || item.source === "crtsh")
        : scenario === "empty"
          ? []
          : demoObservations;
  const phase = live ? player.state.phase : scenario === "running" ? "running" : scenario === "empty" ? "idle" : "complete";
  return (
    <main style={{ width: frame ? `${frame}px` : undefined, maxWidth: "100%", margin: "0 auto", padding: "18px" }}>
      {live ? (
        <section aria-label="Demo controls" className="osr-demo-controls">
          <div style={bar}>
            <button className="osr-btn" type="button" onClick={player.play} disabled={player.playing}>
              Play
            </button>
            <button className="osr-btn" type="button" onClick={player.restart}>
              Restart
            </button>
            <button className="osr-btn" type="button" onClick={player.finish}>
              Show finished run
            </button>
            <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", minHeight: "44px", fontSize: "13px" }}>
              <input type="checkbox" checked={reduced} onChange={(event) => setReduced(event.target.checked)} />
              Simulate reduced motion
            </label>
          </div>
          <p className="osr-note osr-note-flush" role="note">
            Demo stream · events keep arriving when motion is paused in the tree; the Motion button only stops decoration. Source start/queue events are simulated here because the backend does not send them yet.
          </p>
          <ol style={logStyle} aria-label="Demo event log">
            {player.log.map((entry, index) => (
              <li key={`${index}:${entry}`}>{entry}</li>
            ))}
          </ol>
        </section>
      ) : null}
      <OsintResultsView
        seed={{ type: "domain", value: "example.com" }}
        run={live || scenario === "running" || scenario === "empty" ? null : demoRun({ statuses: [...statuses], observations: [...observations] })}
        phase={phase}
        runKey={live ? player.runKey : undefined}
        sourceActivity={live ? player.state.activity : undefined}
        motionPolicy={reduced ? "reduced" : "auto"}
        effort="Standard"
        statuses={statuses}
        observations={observations}
        selectedObservationId={selected}
        onSelectObservation={setSelected}
        assessment={scenario === "full" || scenario === "partial" ? demoAssessment : null}
        demoLabel={demoLabel}
        detailActions={
          selected ? (
            <button className="osr-btn" type="button" disabled title="Preview only">
              Save node (preview)
            </button>
          ) : null
        }
      />
    </main>
  );
}
