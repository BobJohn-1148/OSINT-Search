/**
 * Dev-only preview of the OSINT results surface, served by `vite` at /osint-results-preview.html. The real
 * Search page needs the Electron preload bridge, so without this the surface could not be reviewed in a
 * browser at all. It renders the same component the app renders, fed only by the labelled demo fixtures;
 * it is not part of the packaged renderer (the build entry is index.html) and makes no network calls.
 *
 * ?scenario=full|partial|running|empty|many   ?frame=<px> constrains the width like the Search page's main column.
 */
import ReactDOM from "react-dom/client";
import { Preview } from "./osint-results-preview-page";
import "./theme.css";

const rootElement = document.getElementById("root");
if (rootElement) {
  document.body.style.margin = "0";
  document.body.style.background = "var(--color-app)";
  document.documentElement.style.colorScheme = "dark";
  ReactDOM.createRoot(rootElement).render(<Preview />);
}
