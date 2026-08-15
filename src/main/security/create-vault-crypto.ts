/**
 * Runtime crypto selection prefers Windows-backed safeStorage and falls back to
 * libsodium only when that API is unavailable. If startup silently chose a weak
 * plaintext fallback, Jack's API keys would be exposed to simple database reads.
 */
import { app } from "electron";
import { ElectronSafeStorageCrypto } from "./electron-safe-storage-crypto.js";
import { createSodiumFallbackCrypto, type VaultCrypto } from "./vault-crypto.js";

export async function createVaultCrypto(): Promise<VaultCrypto> {
  if (ElectronSafeStorageCrypto.isAvailable()) {
    return new ElectronSafeStorageCrypto();
  }

  return createSodiumFallbackCrypto(app.getPath("userData"));
}
