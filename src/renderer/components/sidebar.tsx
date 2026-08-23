/**
 * The sidebar owns collapse persistence because shell chrome must survive route
 * reloads without asking future feature pages to coordinate layout state. If the
 * setting lived inside each route, navigation would reset the investigator's
 * workspace on every surface switch.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import brandMark from "../../../assets/brand/reacher-icon-64.png";
import { navigationRoutes } from "../navigation";

interface SidebarProps {
  readonly collapsed: boolean;
  readonly onCollapsedChange: (collapsed: boolean) => void;
}

export function Sidebar({ collapsed, onCollapsedChange }: SidebarProps) {
  const ToggleIcon = collapsed ? ChevronRight : ChevronLeft;
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <aside className={collapsed ? "app-sidebar sidebar-collapsed" : "app-sidebar"} aria-label="Primary navigation">
      <div className="sidebar-inner">
        <div className="brand-row">
          <img className="brand-mark" src={brandMark} alt="" aria-hidden="true" />
          <div className="brand-name">Reacher</div>
          <button
            className="icon-button sidebar-toggle"
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => onCollapsedChange(!collapsed)}
          >
            <ToggleIcon size={18} aria-hidden="true" />
          </button>
        </div>
        <nav className="nav-list">
          {navigationRoutes.map((route) => {
            const isActive = route.path === "/" ? location.pathname === "/" : location.pathname === route.path;
            return (
              <button
                key={route.id}
                className={isActive ? "nav-link active" : "nav-link"}
                type="button"
                aria-current={isActive ? "page" : undefined}
                aria-label={`Open ${route.label}`}
                title={collapsed ? route.label : undefined}
                onClick={() => {
                  void navigate(route.path);
                }}
              >
                <route.Icon size={18} aria-hidden="true" />
                <span className="nav-label">{route.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-status" aria-hidden="true">
          <span className="sidebar-status-dot" />
          reacher@local:~
          <span className="sidebar-cursor" />
        </div>
      </div>
    </aside>
  );
}
