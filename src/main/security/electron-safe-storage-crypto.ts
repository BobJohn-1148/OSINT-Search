/**
 * Electron safeStorage is wrapped away from the repository because encryption
 * availability is a platform concern, not a SQL concern. If the vault repo
 * imported Electron directly, unit tests would have to mock the desktop runtime
 * before they could prove plaintext never lands in the database.
 */
import electron from "electron";
import type { VaultCrypto } from "./vault-crypto.js";

const { safeStorage } = electron;

export class ElectronSafeStorageCrypto implements VaultCrypto {
  public readonly backendId = "safeStorage";

  public static isAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }

  public encryptString(secret: string): string {
    return `safeStorage:${safeStorage.encryptString(secret).toString("base64")}`;
  }

  public decryptString(ciphertext: string): string {
    if (!ciphertext.startsWith("safeStorage:")) {
      throw new Error("Ciphertext was not written by Electron safeStorage");
    }

    return safeStorage.decryptString(Buffer.from(ciphertext.slice("safeStorage:".length), "base64"));
  }
}
