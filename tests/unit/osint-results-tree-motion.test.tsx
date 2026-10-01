/**
 * The tree's animation is layered on evidence, so these tests pin the contract from the graph-animation handoff at the
 * rendered level: arrivals draw and are selectable at once, a second distinct source on the same exact fact pings once,
 * repeats and re-renders never replay, a new run starts clean, every timer ends with the run or the component, and the
 * motion switch, reduced motion and a saved case all leave a fully usable tree. If any drifted, the pings would stop
 * meaning "new evidence arrived" or the view would keep working after it should have stopped.
 */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { OsintResultsView, type OsintResultsProps } from "../../src/renderer/components/osint-results-view";
import type { Observation, SourceStatus } from "../../src/shared/types/search";

function obs(id: string, source: string, value: string, type = "ip"): Observation {
  return { id, runId: "run-1", entity: "example.com", type, value, source, confidence: 1, upstreamFamilyId: `family:${source}` };
}
const ok = (sourceId: string, count = 1): SourceStatus => ({ sourceId, label: sourceId.toUpperCase(), status: "returned", observationCount: count });

type Props = Partial<OsintResultsProps>;
function element(observations: readonly Observation[], statuses: readonly SourceStatus[], props: Props = {}): ReactElement {
  return (
    <OsintResultsView
      seed={{ type: "domain", value: "example.com" }}
      run={null}
      phase="running"
      runKey="run-1"
      effort="Standard"
      statuses={statuses}
      observations={observations}
      selectedObservationId={null}
      onSelectObservation={() => undefined}
      {...props}
    />
  );
}

const tree = (): HTMLElement => screen.getByRole("group", { name: /Evidence tree for/ });
const count = (selector: string): number => tree().querySelectorAll(selector).length;
const settle = (ms = 2500): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

const a1 = obs("a1", "dns-a", "192.0.2.42");
const b1 = obs("b1", "dns-b", "192.0.2.42");

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("arrival", () => {
  it("draws the first source's branch and leaf immediately, selectable, with the true count", () => {
    const view = render(element([], []));
    view.rerender(element([a1], [ok("dns-a")]));
    expect(count(".osr-t-fact")).toBe(1);
    expect(count(".osr-t-fact.is-new")).toBe(1);
    expect(count(".osr-t-edge.is-new")).toBeGreaterThanOrEqual(2);
    expect(within(screen.getByRole("region", { name: "Evidence totals" })).getByText("Unique facts").nextElementSibling).toHaveTextContent("1");
    // selectable at once: the animation never holds the data back
    fireEvent.click(within(tree()).getByRole("button", { name: /192\.0\.2\.42/ }));
  });

  it("is silent for evidence already on screen when the view first sees the run (opening mid-run or a saved result)", () => {
    render(element([a1, b1], [ok("dns-a"), ok("dns-b")]));
    expect(count(".is-new")).toBe(0);
    expect(count(".osr-t-ping")).toBe(0);
    expect(count(".osr-t-fact.is-matched")).toBe(1);
  });
});

describe("exact matches", () => {
  it("pings once when a second distinct source reports the same exact fact, onto the existing leaf", () => {
    const view = render(element([], []));
    view.rerender(element([a1], [ok("dns-a")]));
    settle();
    view.rerender(element([a1, b1], [ok("dns-a"), ok("dns-b")]));
    expect(count(".osr-t-fact")).toBe(1);
    expect(count(".osr-t-ping")).toBe(1);
    expect(count(".osr-t-edge-ping")).toBe(1);
    expect(count(".osr-t-fact.is-matched")).toBe(1);
    expect(within(tree()).getByText("Exact match · 2 upstream families")).toBeInTheDocument();
    // a ping is a one-shot overlay: it is gone when its time is up, the outline and badge stay
    settle();
    expect(count(".osr-t-ping")).toBe(0);
    expect(count(".osr-t-edge-ping")).toBe(0);
    expect(count(".osr-t-fact.is-matched")).toBe(1);
    expect(within(tree()).getByText("Exact match · 2 upstream families")).toBeInTheDocument();
  });

  it("does not ping, grow the match count or replay for a repeat from a source already counted", () => {
    const view = render(element([], []));
    view.rerender(element([a1, b1], [ok("dns-a"), ok("dns-b")]));
    settle();
    view.rerender(element([a1, b1, obs("a2", "dns-a", "192.0.2.42"), obs("b2", "dns-b", "192.0.2.42")], [ok("dns-a"), ok("dns-b")]));
    expect(count(".osr-t-ping")).toBe(0);
    expect(count(".is-new")).toBe(0);
    expect(within(screen.getByRole("region", { name: "Evidence totals" })).getByText("Cross-referenced").nextElementSibling).toHaveTextContent("1");
  });

  it("keeps a conflicting value as a separate leaf without match styling", () => {
    const view = render(element([], []));
    view.rerender(element([a1, b1], [ok("dns-a"), ok("dns-b")]));
    settle();
    view.rerender(element([a1, b1, obs("c1", "dns-c", "198.51.100.7")], [ok("dns-a"), ok("dns-b"), ok("dns-c")]));
    expect(count(".osr-t-fact")).toBe(2);
    expect(count(".osr-t-fact.is-matched")).toBe(1);
    expect(count(".osr-t-ping")).toBe(0);
  });
});

describe("source states", () => {
  it("shows failed, skipped and empty sources with the right words while the evidence from the others stays", () => {
    const failed: SourceStatus = { sourceId: "site", label: "Website contacts", status: "failed", observationCount: 0, error: "Request timed out" };
    const skipped: SourceStatus = { sourceId: "paid", label: "Paid provider", status: "skipped", observationCount: 0, error: "Needs a key" };
    render(element([a1], [ok("dns-a"), failed, skipped, ok("nvd", 0)], { phase: "complete", live: false }));
    expect(tree().querySelector(".osr-t-source.is-failed")).not.toBeNull();
    expect(tree().textContent).toContain("· failed");
    expect(tree().textContent).toContain("· skipped");
    expect(tree().textContent).toContain("NVD");
    expect(count(".osr-t-fact")).toBe(1);
  });

  it("marks a source that fails mid-run once, keeps its reason in the detail, and does not loop", () => {
    const view = render(element([a1], [ok("dns-a")]));
    const failed: SourceStatus = { sourceId: "site", label: "Website contacts", status: "failed", observationCount: 0, error: "Request timed out" };
    view.rerender(element([a1], [ok("dns-a"), failed]));
    expect(count(".osr-t-source.is-just-failed")).toBe(1);
    settle();
    expect(count(".osr-t-source.is-just-failed")).toBe(0);
    expect(count(".osr-t-source.is-failed")).toBe(1);
  });

  it("draws per-source loading only from a real lifecycle supplied by the caller, and stops it with the run", () => {
    const activity = new Map([["dns-a", { state: "running" as const, label: "DNS A" }], ["rdap", { state: "queued" as const, label: "RDAP" }]]);
    const view = render(element([], [], { sourceActivity: activity }));
    expect(count(".osr-t-source.is-running")).toBe(1);
    expect(count(".osr-t-source.is-queued")).toBe(1);
    expect(tree().textContent).toContain("· queued");
    view.rerender(element([a1], [ok("dns-a")], { phase: "complete", sourceActivity: new Map() }));
    expect(count(".is-running")).toBe(0);
  });

  it("draws no per-source motion when nothing supplies a lifecycle, only the run-level indicator on the seed", () => {
    render(element([a1], [ok("dns-a")]));
    expect(count(".osr-t-source.is-running")).toBe(0);
    expect(count(".osr-t-seed.is-running")).toBe(1);
  });
});

describe("nothing replays", () => {
  it("leaves the camera, selection and markers alone across filters, selection and a re-render", () => {
    const view = render(element([], []));
    view.rerender(element([a1, b1], [ok("dns-a"), ok("dns-b")]));
    settle();
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(tree()).toHaveAttribute("data-zoom", "1.25");
    fireEvent.click(within(screen.getByRole("group", { name: "Filter evidence" })).getByRole("button", { name: "Cross-referenced" }));
    fireEvent.click(within(tree()).getByRole("button", { name: /192\.0\.2\.42/ }));
    view.rerender(element([a1, b1], [ok("dns-a"), ok("dns-b")]));
    view.rerender(element([b1, a1], [ok("dns-b"), ok("dns-a")]));
    expect(count(".is-new")).toBe(0);
    expect(count(".osr-t-ping")).toBe(0);
    expect(tree()).toHaveAttribute("data-zoom", "1.25");
  });

  it("does not reset the camera when new evidence arrives", () => {
    const view = render(element([a1], [ok("dns-a")]));
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    view.rerender(element([a1, b1], [ok("dns-a"), ok("dns-b")]));
    expect(tree()).toHaveAttribute("data-zoom", "1.25");
  });

  it("defaults to animating only while the run is running: a completed phase without the live prop stays still", () => {
    const view = render(element([a1], [ok("dns-a")], { phase: "complete" }));
    view.rerender(element([a1, b1], [ok("dns-a"), ok("dns-b")], { phase: "complete" }));
    expect(count(".is-new")).toBe(0);
    expect(count(".osr-t-ping")).toBe(0);
    expect(count(".osr-t-fact.is-matched")).toBe(1);
  });

  it("does not animate when the result is not live, such as a saved case, even as evidence changes", () => {
    const view = render(element([a1], [ok("dns-a")], { phase: "complete", live: false }));
    view.rerender(element([a1, b1], [ok("dns-a"), ok("dns-b")], { phase: "complete", live: false }));
    expect(count(".is-new")).toBe(0);
    expect(count(".osr-t-ping")).toBe(0);
    expect(count(".osr-t-fact.is-matched")).toBe(1);
  });
});

describe("runs and timers", () => {
  it("clears a previous run's pings the moment a new run starts and does not re-ping the same evidence", () => {
    const view = render(element([], []));
    view.rerender(element([a1], [ok("dns-a")]));
    view.rerender(element([a1, b1], [ok("dns-a"), ok("dns-b")]));
    expect(count(".osr-t-ping")).toBe(1);
    view.rerender(element([a1, b1], [ok("dns-a"), ok("dns-b")], { runKey: "run-2" }));
    expect(count(".osr-t-ping")).toBe(0);
    expect(count(".is-new")).toBe(0);
    expect(screen.queryByText(/^Latest:/)).not.toBeInTheDocument();
  });

  it("leaves no timer running after a run completes", () => {
    const view = render(element([], []));
    view.rerender(element([a1, b1], [ok("dns-a"), ok("dns-b")]));
    view.rerender(element([a1, b1], [ok("dns-a"), ok("dns-b")], { phase: "complete" }));
    settle(5000);
    expect(vi.getTimerCount()).toBe(0);
    expect(count(".is-running")).toBe(0);
  });

  it("clears every timer on unmount, even in the middle of a burst of arrivals", () => {
    const view = render(element([], []));
    view.rerender(element([a1], [ok("dns-a")]));
    view.rerender(element([a1, b1], [ok("dns-a"), ok("dns-b")]));
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("announcements", () => {
  it("batches arrivals into one short polite line instead of announcing each one", () => {
    const view = render(element([], []));
    view.rerender(element([a1], [ok("dns-a")]));
    view.rerender(element([a1, obs("a2", "dns-a", "mail.example.com", "hostname")], [ok("dns-a")]));
    view.rerender(element([a1, obs("a2", "dns-a", "mail.example.com", "hostname"), b1], [ok("dns-a"), ok("dns-b")]));
    expect(screen.queryByText("2 new facts; 1 new exact match")).not.toBeInTheDocument();
    settle(900);
    const polite = screen.getAllByRole("status").map((node) => node.textContent);
    expect(polite).toContain("2 new facts; 1 new exact match");
    expect(screen.getByText(/^Latest:/)).toHaveTextContent("Latest: 2 new facts; 1 new exact match");
  });
});

describe("motion off", () => {
  it("keeps results updating, with permanent match styling and arrival text, when the in-app switch is off", () => {
    const view = render(element([], []));
    const toggle = screen.getByRole("button", { name: "Motion on" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Motion off" })).toHaveAttribute("aria-pressed", "false");
    view.rerender(element([a1], [ok("dns-a")]));
    view.rerender(element([a1, b1], [ok("dns-a"), ok("dns-b")]));
    expect(tree()).toHaveClass("is-motion-off");
    expect(count(".is-new")).toBe(0);
    expect(count(".osr-t-ping")).toBe(0);
    expect(count(".osr-t-fact.is-matched")).toBe(1);
    expect(within(tree()).getByText("Exact match · 2 upstream families")).toBeInTheDocument();
    settle(900);
    expect(screen.getByText(/^Latest:/)).toHaveTextContent("1 new fact; 1 new exact match");
  });

  it("is forced static by a reduced-motion policy, with the switch disabled and explained", () => {
    const view = render(element([], [], { motionPolicy: "reduced" }));
    view.rerender(element([a1, b1], [ok("dns-a"), ok("dns-b")], { motionPolicy: "reduced" }));
    expect(tree()).toHaveClass("is-motion-off");
    expect(count(".is-new")).toBe(0);
    expect(count(".osr-t-ping")).toBe(0);
    const toggle = screen.getByRole("button", { name: "Motion off" });
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAttribute("title", expect.stringMatching(/reduced motion/i));
    expect(count(".osr-t-fact")).toBe(1);
  });
});

describe("capacity", () => {
  it("bounds the drawing and the animation for a burst, reports the true overflow and keeps the full list", () => {
    const view = render(element([], []));
    const burst = Array.from({ length: 1200 }, (_, index) => obs(`b${index}`, `src-${index % 6}`, `host-${Math.floor(index / 2)}.example.com`, "hostname"));
    const statuses = Array.from({ length: 6 }, (_, index) => ok(`src-${index}`, 200));
    view.rerender(element(burst, statuses));
    expect(count(".osr-t-fact")).toBeLessThanOrEqual(24);
    expect(count(".osr-t-fact.is-new")).toBeLessThanOrEqual(12);
    expect(count(".osr-t-ping")).toBeLessThanOrEqual(48);
    expect(within(screen.getByRole("region", { name: "Evidence totals" })).getByText("Observations").nextElementSibling).toHaveTextContent("1200");
    expect(screen.getByText(/Drawing 24 of 600 facts/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show all 600 facts in the list" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Evidence facts" })).toBeInTheDocument();
  });

  it("takes you to the full evidence list from the overflow action", () => {
    const burst = Array.from({ length: 80 }, (_, index) => obs(`b${index}`, `src-${index % 2}`, `host-${index}.example.com`, "hostname"));
    render(element(burst, [ok("src-0", 40), ok("src-1", 40)], { phase: "complete", live: false }));
    fireEvent.click(screen.getByRole("button", { name: "Show all 80 facts in the list" }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Evidence", level: 2 }));
  });
});

describe("vertical tree", () => {
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 360 });
  });
  afterEach(() => {
    if (original) {
      Object.defineProperty(HTMLElement.prototype, "clientWidth", original);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
    }
  });

  it("uses the stack layout on narrow containers and collapses and expands a branch from the keyboard", () => {
    render(element([a1, b1, obs("a2", "dns-a", "mail.example.com", "hostname")], [ok("dns-a", 2), ok("dns-b")], { phase: "complete", live: false }));
    expect(tree()).toHaveAttribute("data-mode", "stack");
    expect(count(".osr-t-fact")).toBe(2);
    const branch = within(tree()).getByRole("button", { name: /Collapse DNS-A/i });
    expect(branch).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(branch, { key: "Enter" });
    expect(within(tree()).getByRole("button", { name: /Expand DNS-A/i })).toHaveAttribute("aria-expanded", "false");
    expect(count(".osr-t-fact")).toBe(0);
    expect(screen.getByText(/hidden in collapsed branches/)).toBeInTheDocument();
    fireEvent.keyDown(within(tree()).getByRole("button", { name: /Expand DNS-A/i }), { key: " " });
    expect(count(".osr-t-fact")).toBe(2);
  });
});

describe("idle", () => {
  it("shows the root with an instruction and no invented branches", () => {
    render(element([], [], { phase: "idle", runKey: null }));
    expect(count(".osr-t-seed")).toBe(1);
    expect(count(".osr-t-source")).toBe(0);
    expect(count(".osr-t-edge")).toBe(0);
    expect(screen.getByText(/Branches appear only when a source returns/)).toBeInTheDocument();
  });
});
