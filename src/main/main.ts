/**
 * Main process startup keeps database migration, IPC registration, and window
 * creation together because all renderer routes depend on the same local-first
 * trust boundary. If the window opened before migrations and handlers existed,
 * a reload could expose UI that cannot persist or audit actions.
 */
import { BrowserWindow, app } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "../db/database.js";
import { runMigrations } from "../db/migrations/runner.js";
import { registerIpcHandlers } from "./ipc/register.js";
import { createVaultCrypto } from "./security/create-vault-crypto.js";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const repoRoot = path.resolve(currentDir, "..");

function iconPath(): string {
  return path.join(repoRoot, "..", "assets", "brand", "reacher-icon-256.png");
}

function preloadPath(): string {
  return path.join(repoRoot, "preload", "preload.js");
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

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await window.loadURL(devServerUrl);
    return;
  }

  await window.loadFile(path.join(repoRoot, "renderer", "index.html"));
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
