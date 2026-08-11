/**
 * Navigation is data-driven so the sidebar, route stubs, and phase audit inspect
 * one source of truth. If labels and paths were duplicated, a later phase could
 * ship a visible surface with no route or a route with no navigation entry.
 */
import {
  Activity,
  Bot,
  Briefcase,
  FileText,
  Gauge,
  Network,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  TerminalSquare,
  Users,
  Wrench
} from "lucide-react";
import type { LucideProps } from "lucide-react";
import type { ComponentType } from "react";

export interface NavigationRoute {
  readonly id: string;
  readonly path: string;
  readonly label: string;
  readonly summary: string;
  readonly Icon: ComponentType<LucideProps>;
}

export const navigationRoutes: readonly NavigationRoute[] = [
  {
    id: "dashboard",
    path: "/",
    label: "Dashboard",
    summary: "Local activity, cases, watch status, and investigation shortcuts will converge here.",
    Icon: Gauge
  },
  {
    id: "search",
    path: "/search",
    label: "Search",
    summary: "Passive OSINT seeds will fan out and merge into cited observations.",
    Icon: Search
  },
  {
    id: "cases",
    path: "/cases",
    label: "Cases",
    summary: "Saved observations, scans, notes, and reports will be organized by case.",
    Icon: Briefcase
  },
  {
    id: "ai-agents",
    path: "/ai-agents",
    label: "AI agents",
    summary: "Provider-switchable agents will run with shared memory and cited findings.",
    Icon: Bot
  },
  {
    id: "network-scan",
    path: "/network-scan",
    label: "Network scan",
    summary: "Authorized active scans will build topology and host evidence.",
    Icon: Network
  },
  {
    id: "tools",
    path: "/tools",
    label: "Tools",
    summary: "WSL-launched OSINT and cybersecurity tools will be cataloged and audited.",
    Icon: Wrench
  },
  {
    id: "analyzers",
    path: "/analyzers",
    label: "Analyzers",
    summary: "Imported event logs, packet captures, dorks, MACs, and vulnerabilities will be parsed here.",
    Icon: TerminalSquare
  },
  {
    id: "mobile",
    path: "/mobile",
    label: "Mobile",
    summary: "Trusted Android and Apple devices can be inventoried from local USB tooling.",
    Icon: Smartphone
  },
  {
    id: "social-analyzer",
    path: "/social-analyzer",
    label: "Social analyzer",
    summary: "Public username candidates across hundreds of networks can be prepared for verification.",
    Icon: Users
  },
  {
    id: "reports",
    path: "/reports",
    label: "Reports",
    summary: "Case and scan evidence will export into cited report formats.",
    Icon: FileText
  },
  {
    id: "audit-log",
    path: "/audit-log",
    label: "Audit log",
    summary: "Sensitive local actions will be reviewed from the append-only audit table.",
    Icon: ShieldCheck
  },
  {
    id: "settings",
    path: "/settings",
    label: "Settings",
    summary: "Local preferences and later provider configuration will live here.",
    Icon: Settings
  }
] as const;

export const fallbackRoute = {
  id: "not-found",
  path: "*",
  label: "Not found",
  summary: "The requested Reacher surface does not exist yet.",
  Icon: Activity
} as const;
