/**
 * Main process startup keeps database migration, IPC registration, and window
 * creation together because all renderer routes depend on the same local-first
 * trust boundary. If the window opened before migrations and handlers existed,
 * a reload could expose UI that cannot persist or audit actions.
 */
import { BrowserWindow, app, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "../db/database.js";
import { runMigrations } from "../db/migrations/runner.js";
import { loadLocalEnv } from "./env/load-local-env.js";
import { registerIpcHandlers } from "./ipc/register.js";
import { createVaultCrypto } from "./security/create-vault-crypto.js";
import { isAppNavigationUrl, normalizeExternalHttpUrl } from "./security/external-navigation.js";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const repoRoot = path.resolve(currentDir, "..");
loadLocalEnv(path.resolve(repoRoot, "..", ".env.local"));

function iconPath(): string {
  return path.join(repoRoot, "..", "assets", "brand", "reacher-icon-256.png");
}

function preloadPath(): string {
  return path.join(repoRoot, "preload", "preload.cjs");
}

async function createMainWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: "Reacher",
    backgroundColor: "rgb(11, 16, 22)",
    icon: iconPath(),
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternalHttpUrl(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (isAppUrl(url)) {
      return;
    }
    event.preventDefault();
    openExternalHttpUrl(url);
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await window.loadURL(devServerUrl);
    return;
  }

  await window.loadFile(path.join(repoRoot, "renderer", "index.html"));
}

function isAppUrl(url: string): boolean {
  return isAppNavigationUrl(url, process.env.VITE_DEV_SERVER_URL);
}

function openExternalHttpUrl(url: string): void {
  const externalUrl = normalizeExternalHttpUrl(url);
  if (externalUrl) {
    void shell.openExternal(externalUrl);
  }
}

void app.whenReady().then(async () => {
  const db = openDatabase();
  runMigrations(db);
  const vaultCrypto = await createVaultCrypto();
  registerIpcHandlers(db, vaultCrypto);

  await createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });
}).catch((error: unknown) => {
  console.error(error);
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
