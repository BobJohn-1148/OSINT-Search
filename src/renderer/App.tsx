/**
 * App composes routing and persistent chrome without feature-specific state so
 * Phase 0 remains a foundation rather than a hidden product slice. If feature
 * routes owned shell concerns now, later phases would inherit tangled layout and
 * security wiring.
 */
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { AgentsView } from "./components/agents-view";
import { AnalyzersView } from "./components/analyzers-view";
import { CasesView } from "./components/cases-view";
import { ReportsView } from "./components/reports-view";
import { NetworkScanView } from "./components/network-scan-view";
import { Sidebar } from "./components/sidebar";
import { readStoredSidebarState, writeStoredSidebarState } from "./components/sidebar-state";
import { SearchView } from "./components/search-view";
import { SettingsView } from "./components/settings-view";
import { ToolsView } from "./components/tools-view";
import { RouteStub } from "./components/route-stub";
import { fallbackRoute, navigationRoutes } from "./navigation";

export function AppFrame() {
  const [collapsed, setCollapsed] = useState(() => readStoredSidebarState());
  const sidebarWidth = collapsed ? "var(--sidebar-collapsed)" : "var(--sidebar-expanded)";
  const shellStyle = useMemo(() => ({ "--sidebar-width": sidebarWidth }) as CSSProperties, [sidebarWidth]);

  useEffect(() => {
    writeStoredSidebarState(collapsed);
  }, [collapsed]);

  return (
    <div className="app-shell" style={shellStyle}>
      <Sidebar collapsed={collapsed} onCollapsedChange={setCollapsed} />
      <main className="main-panel">
        <Routes>
          {navigationRoutes.map((route) => (
            <Route
              key={route.id}
              path={route.path}
              element={
                route.id === "settings" ? (
                  <SettingsView />
                ) : route.id === "search" ? (
                  <SearchView />
                ) : route.id === "cases" ? (
                  <CasesView />
                ) : route.id === "reports" ? (
                  <ReportsView />
                ) : route.id === "ai-agents" ? (
                  <AgentsView />
                ) : route.id === "tools" ? (
                  <ToolsView />
                ) : route.id === "network-scan" ? (
                  <NetworkScanView />
                ) : route.id === "analyzers" ? (
                  <AnalyzersView />
                ) : (
                  <RouteStub route={route} />
                )
              }
            />
          ))}
          <Route path={fallbackRoute.path} element={<RouteStub route={fallbackRoute} />} />
        </Routes>
      </main>
    </div>
  );
}
