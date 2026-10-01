/**
 * Renderer tests for the OSINT results surface pin what an investigator relies on: a failed source reads as a
 * status and keeps the other evidence, filters and selection work from the keyboard, nothing is corroborated that
 * the observations do not support, and the AI assessment is labelled as interpretation with its confidence exactly
 * as received. If these drifted, the screen could make weak or missing evidence look strong or safe.
 */
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import fs from "node:fs";
import path from "node:path";
import { useState } from "react";
import {
  demoAssessment,
  demoLabel,
  demoManyObservations,
  demoObservations,
  demoRun,
  demoStatuses
} from "../../src/renderer/components/osint-results-demo";
import { OsintResultsView, type OsintAssessment, type OsintResultsProps } from "../../src/renderer/components/osint-results-view";
import type { Observation } from "../../src/shared/types/search";

function Harness(props: Partial<OsintResultsProps> & { readonly initialSelected?: string | null }) {
  const [selected, setSelected] = useState<string | null>(props.initialSelected ?? null);
  return (
    <OsintResultsView
      seed={{ type: "domain", value: "example.com" }}
      run={demoRun()}
      phase="complete"
      effort="Standard"
      statuses={demoStatuses}
      observations={demoObservations}
      selectedObservationId={selected}
      onSelectObservation={setSelected}
      {...props}
    />
  );
}

const list = () => screen.getByRole("list", { name: "Evidence facts" });

describe("source status", () => {
  it("shows a timed-out source as text and a symbol, keeps the other evidence, and does not call the seed absent or safe", () => {
    render(<Harness />);
    const sources = screen.getByRole("region", { name: "Source activity" });
    const failed = within(sources).getByText("Website contacts").closest("li");
    expect(failed).not.toBeNull();
    expect(within(failed as HTMLElement).getByText("Timed out")).toBeInTheDocument();
    expect(within(failed as HTMLElement).getByText("Request timed out after 15 seconds")).toBeInTheDocument();
    expect(screen.getByText(/1 of 5 sources did not return/)).toBeInTheDocument();
    expect(screen.getByText(/not evidence that the seed is absent or safe/)).toBeInTheDocument();
    expect(within(list()).getAllByRole("listitem").length).toBeGreaterThan(0);
    expect(screen.getByText("Complete · 1 failed")).toBeInTheDocument();
  });

  it("shows policy-skipped providers separately from source failures", () => {
    render(
      <Harness
        statuses={[
          ...demoStatuses,
          { sourceId: "scrapegraph-ai", label: "ScrapeGraph AI", status: "skipped", observationCount: 0, error: "Not run: key-required providers are excluded by the current permission defaults." }
        ]}
      />
    );
    const sources = screen.getByRole("region", { name: "Source activity" });
    const skipped = within(sources).getByText("ScrapeGraph AI").closest("li");
    expect(skipped).not.toBeNull();
    expect(within(skipped as HTMLElement).getByText("Skipped")).toBeInTheDocument();
    expect(within(skipped as HTMLElement).getByText(/key-required providers are excluded/)).toBeInTheDocument();
    expect(screen.getByText("Complete · 1 failed · 1 skipped")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Evidence totals" })).getByText("Not returned").nextElementSibling).toHaveTextContent("2");
  });

  it("shows official-source coverage, terms reference, and non-ownership caveat when expanded", async () => {
    const user = userEvent.setup();
    render(<Harness statuses={[
      ...demoStatuses,
      {
        sourceId: "usaspending",
        label: "USAspending (exact UEI)",
        status: "returned",
        observationCount: 0,
        policy: {
          accessMode: "public-api",
          jurisdiction: "US federal",
          documentedQuota: null,
          localRequestBudget: "2 requests/second per app process; at most 3 pages per lookup",
          termsUrl: "https://api.usaspending.gov/docs/endpoints",
          coverage: "Federal awards recipients in USAspending; not a company registry or ownership source.",
          freshness: "Agency reporting lag varies.",
          enabled: true
        }
      }
    ]} />);
    await user.click(screen.getByRole("button", { name: "Expand USAspending (exact UEI) details" }));
    expect(screen.getByText("Federal awards recipients in USAspending; not a company registry or ownership source.")).toBeInTheDocument();
    expect(screen.getByText("https://api.usaspending.gov/docs/endpoints")).toBeInTheDocument();
    expect(screen.getByText(/provider quota not documented/)).toBeInTheDocument();
  });

  it("renders a capped provider response as Partial with the warning and incomplete-result banner", () => {
    render(<Harness statuses={[
      ...demoStatuses,
      {
        sourceId: "usaspending",
        label: "USAspending (exact UEI)",
        status: "returned",
        observationCount: 0,
        warning: "Partial result: the provider reports more pages; only 3 pages were retrieved.",
        policy: {
          accessMode: "public-api",
          jurisdiction: "US federal",
          documentedQuota: null,
          localRequestBudget: "2 requests/second; at most 3 pages per lookup",
          termsUrl: "https://api.usaspending.gov/docs/endpoints",
          coverage: "Federal awards recipients; not an ownership source.",
          freshness: "Agency reporting lag varies.",
          enabled: true
        }
      }
    ]} />);

    const source = screen.getByRole("region", { name: "Source activity" });
    const row = within(source).getByText("USAspending (exact UEI)").closest("li");
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText("Partial")).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText(/only 3 pages were retrieved/)).toBeInTheDocument();
    expect(screen.getByText("Complete · 1 failed · 1 partial")).toBeInTheDocument();
    expect(screen.getByText(/incomplete results/)).toBeInTheDocument();
  });

  it("expands and collapses a source's detail with aria-expanded wired to the panel", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const toggle = screen.getByRole("button", { name: "Expand Website contacts details" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    const open = screen.getByRole("button", { name: "Collapse Website contacts details" });
    expect(open).toHaveAttribute("aria-expanded", "true");
    const panelId = open.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    expect(document.getElementById(panelId ?? "")).toHaveTextContent(/does not show that the seed is absent or safe/);
    await user.click(open);
    expect(screen.getByRole("button", { name: "Expand Website contacts details" })).toHaveAttribute("aria-expanded", "false");
  });

  it("announces source progress in a polite live region", () => {
    render(<Harness />);
    const status = screen.getAllByRole("status").find((element) => element.textContent.includes("sources reported"));
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status?.textContent).toBe("4 of 5 sources reported; 1 failed.");
  });
});

describe("totals and states", () => {
  it("computes every total from the data it is given", () => {
    const observations: Observation[] = demoObservations.slice(0, 3);
    render(<Harness observations={observations} statuses={demoStatuses.slice(0, 2)} run={null} />);
    const totals = screen.getByRole("region", { name: "Evidence totals" });
    expect(within(totals).getByText("Observations").nextElementSibling).toHaveTextContent("3");
    expect(within(totals).getByText("Not returned").nextElementSibling).toHaveTextContent("0");
  });

  it("shows a running state with a spinner label and no completion time", () => {
    render(<Harness phase="running" run={null} observations={[]} statuses={[]} />);
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByText("Waiting for sources")).toBeInTheDocument();
  });

  it("shows the idle seed without inventing evidence before any search", () => {
    render(<Harness phase="idle" run={null} observations={[]} statuses={[]} />);
    expect(screen.getByText("Run a search to grow the tree. Branches appear only when a source returns.")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /Evidence tree for/ })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Evidence facts" })).not.toBeInTheDocument();
  });

  it("labels fixtures as demo data when a label is supplied", () => {
    render(<Harness demoLabel={demoLabel} />);
    expect(screen.getByText(demoLabel)).toBeInTheDocument();
  });
});

describe("discovery results", () => {
  it("labels directory links as discovery resources and explains they are not evidence", async () => {
    const user = userEvent.setup();
    const resource: Observation = {
      id: "directory-link",
      runId: "run-one",
      kind: "discovery",
      entity: "example.com",
      type: "osint-tool",
      value: "Registry search — https://example.test/registry",
      source: "osint4all-catalog",
      confidence: 1
    };
    render(<Harness observations={[resource]} statuses={[]} />);
    await user.click(within(list()).getByRole("button", { name: /Registry search/ }));
    expect(screen.getAllByText("Discovery resource · not evidence").length).toBeGreaterThan(0);
    expect(screen.getByText(/not a fetched record about the subject/)).toBeInTheDocument();
  });
});

describe("evidence filters and selection", () => {
  it("filters all, cross-referenced and single-source with aria-pressed state", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const filters = screen.getByRole("group", { name: "Filter evidence" });
    const all = within(filters).getByRole("button", { name: "All" });
    const cross = within(filters).getByRole("button", { name: "Cross-referenced" });
    const single = within(filters).getByRole("button", { name: "Single source" });
    expect(all).toHaveAttribute("aria-pressed", "true");
    const total = within(list()).getAllByRole("listitem").length;

    await user.click(cross);
    expect(cross).toHaveAttribute("aria-pressed", "true");
    expect(all).toHaveAttribute("aria-pressed", "false");
    const crossRows = within(list()).getAllByRole("listitem");
    expect(crossRows).toHaveLength(2);
    expect(within(list()).queryByText("Single source · uncorroborated")).not.toBeInTheDocument();

    await user.click(single);
    expect(within(list()).getAllByRole("listitem")).toHaveLength(total - 2);
    expect(within(list()).queryByText(/Exact match/)).not.toBeInTheDocument();
  });

  it("filters by text and by an exact source chip, and reports when nothing matches", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByRole("searchbox", { name: "Filter evidence text" }), "registrar");
    expect(within(list()).getAllByRole("listitem")).toHaveLength(1);
    await user.clear(screen.getByRole("searchbox", { name: "Filter evidence text" }));

    const chips = screen.getByRole("group", { name: "Filter by source" });
    const rdap = within(chips).getByRole("button", { name: "RDAP" });
    await user.click(rdap);
    expect(rdap).toHaveAttribute("aria-pressed", "true");
    expect(within(list()).getAllByRole("listitem")).toHaveLength(4);
    await user.click(rdap);
    expect(rdap).toHaveAttribute("aria-pressed", "false");

    await user.type(screen.getByRole("searchbox", { name: "Filter evidence text" }), "zzz-not-present");
    expect(screen.getByText("No evidence matches the current filters.")).toBeInTheDocument();
  });

  it("selects an observation from the list and shows its provenance, entity, value and raw detail", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const row = within(list()).getByRole("button", { name: /192\.0\.2\.42/ });
    expect(row).toHaveAttribute("aria-pressed", "false");
    await user.click(row);
    expect(row).toHaveAttribute("aria-pressed", "true");
    const detail = screen.getByRole("region", { name: "Selected evidence" });
    expect(within(detail).getByText("Entity").nextElementSibling).toHaveTextContent("example.com");
    expect(within(detail).getByText("Observed value").nextElementSibling).toHaveTextContent("192.0.2.42");
    expect(within(detail).getAllByText("DNS over HTTPS").length).toBeGreaterThan(0);
    // the same source returned this fact twice; both of its records stay visible as provenance
    expect(within(detail).getAllByText("https://dns.example.test/resolve?name=example.com")).toHaveLength(2);
    expect(within(detail).getAllByText("Raw source detail").length).toBeGreaterThan(0);
    expect(within(detail).getByText(/Only one declared upstream family returned this fact/)).toBeInTheDocument();
  });

  it("lists each reporting source's own record as provenance for a cross-referenced fact", () => {
    render(<Harness initialSelected="dns-01" />);
    const detail = screen.getByRole("region", { name: "Selected evidence" });
    expect(within(detail).getByText("2 declared upstream families returned this exact domain; integrations: crtsh, dns-doh, rdap. Family declarations are recorded for comparison, not independently audited.")).toBeInTheDocument();
    for (const id of ["dns-01", "ct-01", "rd-01"]) {
      expect(within(detail).getByText(id)).toBeInTheDocument();
    }
  });

  it("keeps showing a selected item that the current filters hide, and says so", async () => {
    const user = userEvent.setup();
    render(<Harness initialSelected="rd-02" />);
    await user.click(within(screen.getByRole("group", { name: "Filter evidence" })).getByRole("button", { name: "Cross-referenced" }));
    expect(screen.getByText("This item is hidden from the list by the current filters.")).toBeInTheDocument();
  });

  it("places the existing actions beside the selection", () => {
    render(<Harness initialSelected="dns-01" detailActions={<button type="button">Save node</button>} />);
    expect(within(screen.getByRole("region", { name: "Selected evidence" })).getByRole("button", { name: "Save node" })).toBeInTheDocument();
  });

  it("pages a long evidence list instead of rendering everything at once", async () => {
    const user = userEvent.setup();
    const { statuses, observations } = demoManyObservations(240);
    render(<Harness observations={observations} statuses={statuses} run={null} />);
    expect(within(list()).getAllByRole("listitem")).toHaveLength(50);
    await user.click(screen.getByRole("button", { name: "Show 50 more" }));
    expect(within(list()).getAllByRole("listitem")).toHaveLength(100);
    await user.click(screen.getByRole("button", { name: "Show 20 more" }));
    expect(within(list()).getAllByRole("listitem")).toHaveLength(120);
    expect(screen.queryByRole("button", { name: /Show \d+ more/ })).not.toBeInTheDocument();
  });
});

describe("untrusted and oversized values", () => {
  it("cuts a huge value for display in the row and the detail, and a huge raw object in the raw detail", async () => {
    const user = userEvent.setup();
    const huge = "x".repeat(100_000);
    const big: Observation[] = [{ id: "big", runId: "r", entity: "example.com", type: "note", value: huge, source: "rdap", confidence: 1, raw: { blob: "y".repeat(50_000) } }];
    render(<Harness observations={big} statuses={[]} run={null} initialSelected="big" />);
    expect(document.body.textContent.length).toBeLessThan(20_000);
    await user.click(within(screen.getByRole("region", { name: "Selected evidence" })).getByText("Raw source detail"));
    expect(screen.getByText(/\(truncated\)/)).toBeInTheDocument();
  });

  it("returns to the first page when a filter changes", async () => {
    const user = userEvent.setup();
    const { statuses, observations } = demoManyObservations(240);
    render(<Harness observations={observations} statuses={statuses} run={null} />);
    await user.click(screen.getByRole("button", { name: "Show 50 more" }));
    expect(within(list()).getAllByRole("listitem")).toHaveLength(100);
    await user.click(within(screen.getByRole("group", { name: "Filter evidence" })).getByRole("button", { name: "Cross-referenced" }));
    expect(within(list()).getAllByRole("listitem")).toHaveLength(50);
  });
});

describe("narrow containers", () => {
  function narrow(width: number): () => void {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => width });
    return () => {
      if (original) {
        Object.defineProperty(HTMLElement.prototype, "clientWidth", original);
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
      }
    };
  }

  it("opens the selected record's detail under its own row, with no separate side column", async () => {
    const restore = narrow(600);
    try {
      const user = userEvent.setup();
      render(<Harness />);
      // nothing selected yet: the list itself is the prompt, so no empty detail box takes space
      expect(screen.queryByRole("region", { name: "Selected evidence" })).not.toBeInTheDocument();
      const row = within(list()).getByRole("button", { name: /192\.0\.2\.42/ });
      await user.click(row);
      const item = row.closest("li") as HTMLElement;
      expect(within(item).getByRole("region", { name: "Selected evidence" })).toBeInTheDocument();
      expect(screen.getAllByRole("region", { name: "Selected evidence" })).toHaveLength(1);
    } finally {
      restore();
    }
  });

  it("keeps the side column on wide containers", () => {
    const restore = narrow(1200);
    try {
      render(<Harness initialSelected="dns-01" />);
      const detail = screen.getByRole("region", { name: "Selected evidence" });
      expect(detail.closest("li")).toBeNull();
    } finally {
      restore();
    }
  });

  it("keeps a map-selected fact in the page even when it sits past the first page of rows", () => {
    const { statuses, observations } = demoManyObservations(240);
    const target = observations.at(-1);
    render(<Harness observations={observations} statuses={statuses} run={null} initialSelected={target?.id ?? null} />);
    expect(within(list()).getAllByRole("listitem").length).toBeGreaterThan(50);
    expect(within(list()).getAllByRole("button").some((button) => button.getAttribute("aria-pressed") === "true")).toBe(true);
  });
});

describe("correlation is not fabricated", () => {
  it("keeps a repeat from one source single-source, however the run's entity table grades it", () => {
    const repeat: Observation[] = [
      { id: "a", runId: "r", entity: "example.com", type: "ip", value: "192.0.2.42", source: "dns-doh", confidence: 4 },
      { id: "b", runId: "r", entity: "example.com", type: "ip", value: "192.0.2.42", source: "dns-doh", confidence: 4 }
    ];
    render(
      <Harness
        observations={repeat}
        statuses={[{ sourceId: "dns-doh", label: "DNS over HTTPS", status: "returned", observationCount: 2 }]}
        run={demoRun({
          observations: repeat,
          entities: [{ entity: "example.com", type: "ip", value: "192.0.2.42", sourceIds: ["dns-doh", "a", "b", "c"], upstreamFamilyIds: ["a", "b", "c", "d"], strength: 4, band: "confirmed" }]
        })}
      />
    );
    const totals = screen.getByRole("region", { name: "Evidence totals" });
    expect(within(totals).getByText("Cross-referenced").nextElementSibling).toHaveTextContent("0");
    expect(within(list()).getByText("Single source · uncorroborated")).toBeInTheDocument();
    expect(within(list()).queryByText(/Exact match/)).not.toBeInTheDocument();
  });

  it("draws a map edge from a source to a fact only when that source returned that fact", () => {
    render(<Harness />);
    const svg = screen.getByRole("group", { name: /Evidence tree for domain example\.com/ });
    const factNodes = within(svg).getAllByRole("button");
    expect(factNodes).toHaveLength(9);
    const matchedEdges = svg.querySelectorAll(".osr-t-edge.is-matched");
    // domain example.com (3 sources) + mail.example.com (2 sources) = 5 source-to-fact lines, 2 of them primary branches
    expect(matchedEdges).toHaveLength(5);
    // one primary branch per fact, and a cross-link for every additional source that returned the same exact fact
    expect(svg.querySelectorAll(".osr-t-edge-cross")).toHaveLength(3);
  });
});

describe("evidence tree interaction", () => {
  it("selects the matching evidence when a graph node is activated", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const svg = screen.getByRole("group", { name: /Evidence tree for/ });
    await user.click(within(svg).getByRole("button", { name: /registrar: Example Registrar/ }));
    const detail = screen.getByRole("region", { name: "Selected evidence" });
    expect(within(detail).getByText("Observed value").nextElementSibling).toHaveTextContent("Example Registrar");
    expect(within(list()).getByRole("button", { name: /Example Registrar/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("is operable from the keyboard with a single tab stop and arrow-key movement", async () => {
    const user = userEvent.setup();
    render(<Harness initialSelected="dns-01" />);
    const svg = screen.getByRole("group", { name: /Evidence tree for/ });
    const stops = within(svg).getAllByRole("button").filter((node) => node.getAttribute("tabindex") === "0");
    expect(stops).toHaveLength(1);
    stops[0]?.focus();
    await user.keyboard("{ArrowRight}");
    const pressed = within(svg).getAllByRole("button").filter((node) => node.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).not.toBe(stops[0]);
    // Enter selects the focused node: moving focus without selecting must not look like selection, and Enter must commit it
    const second = document.activeElement as HTMLElement;
    expect(second.getAttribute("aria-pressed")).toBe("true");
    await user.keyboard("{ArrowRight}");
    const third = document.activeElement as HTMLElement;
    expect(third).not.toBe(second);
    expect(second.getAttribute("aria-pressed")).toBe("false");
    await user.keyboard("{Enter}");
    expect(third.getAttribute("aria-pressed")).toBe("true");
    expect(within(screen.getByRole("region", { name: "Selected evidence" })).getByText("Observed value")).toBeInTheDocument();
  });

  it("marks a failed source on the map with text as well as a symbol", () => {
    render(<Harness />);
    const svg = screen.getByRole("group", { name: /Evidence tree for/ });
    expect(within(svg).getByRole("img", { name: "Source Website contacts · Timed out" })).toBeInTheDocument();
    expect(svg.textContent).toContain("Website contacts");
    expect(svg.textContent).toContain("· failed");
  });

  it("selects with Space as well as Enter, so the map works for every keyboard user", async () => {
    const user = userEvent.setup();
    render(<Harness initialSelected="dns-01" />);
    const svg = screen.getByRole("group", { name: /Evidence tree for/ });
    const nodes = within(svg).getAllByRole("button");
    const target = nodes.find((node) => node.getAttribute("aria-pressed") === "false");
    expect(target).toBeDefined();
    act(() => {
      (target as unknown as SVGElement).focus();
    });
    await user.keyboard(" ");
    expect(target?.getAttribute("aria-pressed")).toBe("true");
  });

  it("zooms with labelled buttons that disable at their limits and resets with Fit", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const svg = screen.getByRole("group", { name: /Evidence tree for/ });
    expect(svg).toHaveAttribute("data-zoom", "1.00");
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(svg).toHaveAttribute("data-zoom", "1.25");
    await user.click(screen.getByRole("button", { name: "Zoom out" }));
    await user.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(svg.getAttribute("data-zoom")).toBe("0.80");
    await user.click(screen.getByRole("button", { name: "Fit" }));
    expect(svg).toHaveAttribute("data-zoom", "1.00");
    for (let step = 0; step < 6; step += 1) {
      await user.click(screen.getByRole("button", { name: "Zoom in" }));
    }
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeDisabled();
  });

  it("says when the map is showing only part of a large run and points to the complete list", () => {
    const { statuses, observations } = demoManyObservations(240);
    render(<Harness observations={observations} statuses={statuses} run={null} />);
    expect(screen.getByText(/Drawing 24 of 120 facts/)).toBeInTheDocument();
  });
});

describe("AI assessment is an interpretation", () => {
  it("is labelled as interpretation, separate from source evidence, with citations and confidence exactly as received", async () => {
    const user = userEvent.setup();
    const assessment: OsintAssessment = { ...demoAssessment, sources: ["dns-01", "case-item:xyz"], confidence: 1 };
    render(<Harness assessment={assessment} />);
    const region = screen.getByRole("region", { name: "AI assessment" });
    expect(within(region).getByText("Interpretation")).toBeInTheDocument();
    expect(within(region).getByText("Confidence as reported · 1")).toBeInTheDocument();
    expect(within(region).getByText(/interpretation of the cited records, not a source result/)).toBeInTheDocument();
    // a citation that matches a returned observation navigates to it; one that does not is shown as given
    expect(within(region).getByText("case-item:xyz").tagName).toBe("SPAN");
    await user.click(within(region).getByRole("button", { name: "dns-01" }));
    expect(within(list()).getAllByRole("button", { name: /example\.com.*Exact match · 2 upstream families/s })[0]).toHaveAttribute("aria-pressed", "true");
  });

  it("never recalculates the confidence it was given", () => {
    render(<Harness assessment={{ ...demoAssessment, confidence: 3 }} />);
    expect(screen.getByText("Confidence as reported · 3")).toBeInTheDocument();
    expect(screen.queryByText(/verified|high confidence/i)).not.toBeInTheDocument();
  });

  it("does not render the assessment as evidence rows, and says so plainly when there is none", () => {
    render(<Harness />);
    const region = screen.getByRole("region", { name: "AI assessment" });
    expect(within(region).getByText(/No AI assessment for this run/)).toBeInTheDocument();
    expect(within(list()).queryByText("Interpretation")).not.toBeInTheDocument();
  });
});

describe("record selection inside a cross-source fact", () => {
  it("lets the investigator choose which source's record the actions use", async () => {
    const user = userEvent.setup();
    render(<Harness initialSelected="dns-01" />);
    const detail = screen.getByRole("region", { name: "Selected evidence" });
    expect(within(detail).getByText("Selected record · actions below use this one")).toBeInTheDocument();
    const picks = within(detail).getAllByRole("button", { name: /^Use the .+ record .+/ });
    expect(picks).toHaveLength(2);
    expect(within(detail).getByText("dns-01").closest("li")).toHaveClass("is-current");
    await user.click(picks[0]);
    expect(within(detail).getAllByText(/Selected record/)).toHaveLength(1);
    expect(within(detail).getByText("dns-01").closest("li")).not.toHaveClass("is-current");
  });

  it("does not offer a choice when a fact has a single record", () => {
    render(<Harness initialSelected="rd-02" />);
    expect(within(screen.getByRole("region", { name: "Selected evidence" })).queryByRole("button", { name: /^Use the .+ record/ })).not.toBeInTheDocument();
  });

  it("copes with duplicate observation ids without duplicate-key trouble", () => {
    const twin: Observation[] = [
      { id: "same", runId: "r", entity: "example.com", type: "ip", value: "192.0.2.42", source: "dns-doh", confidence: 1 },
      { id: "same", runId: "r", entity: "example.com", type: "ip", value: "192.0.2.42", source: "crtsh", confidence: 1 }
    ];
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<Harness observations={twin} statuses={[]} run={null} initialSelected="same" />);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("screen reader behaviour", () => {
  it("speaks a short selection line, not the whole detail, and keeps the detail and the count silent", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const detail = screen.getByRole("region", { name: "Selected evidence" });
    expect(detail).not.toHaveAttribute("aria-live");
    expect(screen.getByText(/Showing \d+ of \d+ fact/)).not.toHaveAttribute("aria-live");
    await user.click(within(list()).getByRole("button", { name: /192\.0\.2\.42/ }));
    const live = screen.getAllByRole("status").filter((element) => element.getAttribute("aria-live") === "polite");
    // sources, the selection, and the tree's batched arrivals: three short polite lines, none of them per observation
    expect(live).toHaveLength(3);
    expect(live.map((element) => element.textContent).join(" ")).toContain("Selected ip 192.0.2.42. Single source · uncorroborated.");
  });
});

describe("assessment context", () => {
  it("says what the assessment was requested for, so it is not read as a verdict on the current selection", () => {
    render(<Harness assessment={{ ...demoAssessment, about: "domain: example.com" }} initialSelected="rd-02" />);
    expect(within(screen.getByRole("region", { name: "AI assessment" })).getByText("Requested for · domain: example.com")).toBeInTheDocument();
  });
});

describe("structure and accessibility", () => {
  it("exposes labelled regions and a heading outline", () => {
    render(<Harness />);
    for (const name of ["Investigation output", "Evidence totals", "Evidence tree", "Source activity", "AI assessment", "Evidence"]) {
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("group", { name: "Investigation status" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThanOrEqual(5);
  });

  it("never opens source URLs as links: untrusted strings stay plain text", () => {
    render(<Harness initialSelected="dns-01" />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("styles are scoped, token-only and honour reduced motion", () => {
    const css = fs.readFileSync(path.resolve(import.meta.dirname, "../../src/renderer/osint-results.css"), "utf8");
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/\b(?:rgb|rgba|hsl|hsla|oklch|lab|lch)\(/i);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none !important/);
    const treeCss = fs.readFileSync(path.resolve(import.meta.dirname, "../../src/renderer/osint-results-tree.css"), "utf8");
    // vertical swipes on the tree must reach the page (a `none` here makes the tree a scroll trap on touch screens)
    expect(treeCss).toMatch(/\.osr \.osr-tree \{[^}]*touch-action: pan-y pinch-zoom/);
    // the node's own focus ring replaces the container-wide rectangle (the selector must beat `.osr [role="button"]:focus-visible`)
    expect(treeCss).toMatch(/\.osr \.osr-t-node:focus-visible \{\s*outline: none;/);
    // the in-app switch and the system setting both switch every animation and transition off, and nothing here is colour-literal
    expect(treeCss).toMatch(/\.osr-tree\.is-motion-off[\s\S]*animation: none !important/);
    expect(treeCss).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none !important/);
    // a cross-link keeps its own look on an exact match, so primary branches and cross-links never look alike
    expect(treeCss).toMatch(/\.osr-t-edge-cross\.is-matched \{[^}]*stroke: var\(--osr-cross\)/);
    expect(treeCss).toMatch(/\.osr-t-edge-branch\.is-matched[\s\S]*?\{[^}]*stroke: var\(--osr-match\)/);
    // the in-app Motion switch stops the status spinner as well (the view sets data-motion on its root)
    expect(css).toMatch(/\.osr\[data-motion="off"\] \.osr-spin \{\s*animation: none/);
    // a selected fact's cross-link stays lighter than its primary branch
    expect(treeCss).toMatch(/\.osr-t-edge-cross\.is-active \{[^}]*stroke-width: 1\.8/);
    // decorative motion pauses while the page is hidden (needs !important to beat the animation shorthand)
    expect(treeCss).toMatch(/is-page-hidden[^{]*\.osr-t-halo[^{]*\{[^}]*animation-play-state: paused !important/);
    // nothing loops except the halo of a thing that is really running, no ping repeats, and no blur filter runs on edges
    expect(treeCss.match(/infinite/g) ?? []).toHaveLength(1);
    expect(treeCss).toMatch(/is-running \.osr-t-halo[\s\S]*?infinite/);
    expect(treeCss).not.toMatch(/blur\(/);
    expect(treeCss).not.toMatch(/\.osr-t-edge[^{]*\{[^}]*filter:/);
    expect(treeCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(treeCss).not.toMatch(/\b(?:rgb|rgba|hsl|hsla|oklch|lab|lch)\(/i);
    const selectors = css
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/@keyframes [\w-]+ \{[\s\S]*?\n\}\n/g, "")
      .split("{")
      .slice(0, -1)
      .map((chunk) => chunk.split("}").pop()?.trim() ?? "")
      .filter((selector) => selector && !selector.startsWith("@") && !/^(from|to|\d+%|0%,)/.test(selector));
    const unscoped = selectors.filter((selector) => selector.split(",").some((part) => !part.trim().startsWith(".osr") && !/^(from|to|\d)/.test(part.trim())));
    expect(unscoped).toEqual([]);
  });
});
