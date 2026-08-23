/**
 * Sidebar persistence is kept separate from the component so Fast Refresh can
 * reload visual chrome without recreating storage helpers. If state helpers lived
 * beside JSX exports, tooling would warn and future shell edits would be noisier.
 */
const storageKey = "reacher.sidebar.collapsed";

export function readStoredSidebarState(): boolean {
  return window.localStorage.getItem(storageKey) === "true";
}

export function writeStoredSidebarState(collapsed: boolean): void {
  window.localStorage.setItem(storageKey, String(collapsed));
}
