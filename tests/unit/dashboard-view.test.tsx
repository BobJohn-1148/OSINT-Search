/**
 * The dashboard's quick-search card was dropped in the monitoring-wall redesign
 * even though REACHER_PLAN.md phase 12 lists it as an exit criterion. It is the
 * one control on the wall that starts new work, so this test pins the contract
 * that matters: a typed seed reaches the Search route as router state (Search
 * itself owns the fan-out and the board), and an empty target never navigates.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { DashboardView } from "../../src/renderer/components/dashboard-view";
import type { Result } from "../../src/shared/result";

function installBridge(): void {
  const invoke = (channel: string): Promise<Result<unknown>> => {
    if (channel === "dashboard:summary") {
      return Promise.resolve({
        ok: true as const,
        value: {
          activeCases: [],
          recentSearches: [],
          recentAgentRuns: [],
          agentStatus: { working: 0, idle: 0, offline: 0, error: 0, states: [] },
          watchAlerts: [],
          recentAudit: []
        }
      });
    }
    if (channel === "watch:list") {
      return Promise.resolve({ ok: true as const, value: { watches: [], alerts: [] } });
    }
    if (channel === "watch:exposures") {
      return Promise.resolve({ ok: true as const, value: { exposures: [] } });
    }
    if (channel === "cases:list") {
      return Promise.resolve({ ok: true as const, value: { cases: [] } });
    }
    return Promise.resolve({ ok: true as const, value: {} });
  };
  Object.defineProperty(window, "reacher", {
    configurable: true,
    value: { channels: [], invoke: vi.fn(invoke), onSearchEvent: vi.fn().mockReturnValue(() => {}), onAgentEvent: vi.fn().mockReturnValue(() => {}) }
  });
}

function SearchProbe() {
  const location = useLocation();
  return <div data-testid="search-seed">{JSON.stringify(location.state)}</div>;
}

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<DashboardView />} />
        <Route path="/search" element={<SearchProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

it("quick search hands the typed seed to the Search route so a lookup can start from the dashboard", async () => {
  const user = userEvent.setup();
  installBridge();

  renderDashboard();

  await user.selectOptions(await screen.findByLabelText("Quick search seed type"), "domain");
  await user.type(screen.getByLabelText("Quick search target"), "acme.com");
  await user.click(screen.getByRole("button", { name: "Run" }));

  await waitFor(() => {
    expect(screen.getByTestId("search-seed")).toHaveTextContent(
      JSON.stringify({ seed: { type: "domain", value: "acme.com" } })
    );
  });
});

it("quick search does not navigate when the target is empty so a stray click is harmless", async () => {
  const user = userEvent.setup();
  installBridge();

  renderDashboard();

  await user.click(await screen.findByRole("button", { name: "Run" }));

  expect(screen.queryByTestId("search-seed")).not.toBeInTheDocument();
  expect(await screen.findByText("Enter a quick search target")).toBeInTheDocument();
});
