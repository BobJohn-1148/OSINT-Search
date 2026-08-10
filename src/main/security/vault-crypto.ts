/**
 * Vault crypto is an interface because Electron safeStorage is the preferred
 * Windows runtime path while tests and unavailable safeStorage need a real
 * encrypted fallback. If repositories knew which backend they used, a later
 * platform fallback could accidentally store plaintext to keep tests passing.
 */
import fs from "node:fs";
import path from "node:path";
import sodium from "libsodium-wrappers";

export interface VaultCrypto {
  readonly backendId: string;
  encryptString(secret: string): string;
  decryptString(ciphertext: string): string;
}

export class SodiumVaultCrypto implements VaultCrypto {
  public readonly backendId = "sodium";

  private constructor(private readonly key: Uint8Array) {}

  public static async fromKey(key: Uint8Array): Promise<SodiumVaultCrypto> {
    await sodium.ready;
    if (key.length !== sodium.crypto_secretbox_KEYBYTES) {
      throw new Error("Vault fallback key must be 32 bytes");
    }
    return new SodiumVaultCrypto(key);
  }

  public encryptString(secret: string): string {
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    const cipher = sodium.crypto_secretbox_easy(secret, nonce, this.key, "base64");
    const nonceText = sodium.to_base64(nonce);
    return `sodium:${nonceText}:${cipher}`;
  }

  public decryptString(ciphertext: string): string {
    const parts = ciphertext.split(":");
    if (parts.length !== 3 || parts[0] !== "sodium") {
      throw new Error("Ciphertext was not written by the sodium vault backend");
    }

    const nonce = sodium.from_base64(parts[1]);
    const cipher = sodium.from_base64(parts[2]);
    return sodium.crypto_secretbox_open_easy(cipher, nonce, this.key, "text");
  }
}

export async function createSodiumFallbackCrypto(userDataPath: string): Promise<SodiumVaultCrypto> {
  await sodium.ready;
  const keyPath = path.join(userDataPath, "vault-fallback.key");
  if (!fs.existsSync(keyPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
    const key = sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES);
    fs.writeFileSync(keyPath, Buffer.from(key).toString("base64"), { mode: 0o600 });
  }

  const key = sodium.from_base64(fs.readFileSync(keyPath, "utf8"));
  return SodiumVaultCrypto.fromKey(key);
}
