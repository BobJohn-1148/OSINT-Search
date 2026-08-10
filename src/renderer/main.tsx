/**
 * Renderer startup mounts through HashRouter because packaged Electron apps load
 * from a file URL. If BrowserRouter were used here, refreshing a stub route in a
 * packaged build would ask the filesystem for a matching path and fail.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { AppFrame } from "./App";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Reacher renderer root is missing");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <HashRouter>
      <AppFrame />
    </HashRouter>
  </React.StrictMode>
);
