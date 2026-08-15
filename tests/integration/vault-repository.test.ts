/**
 * Vault repository tests use real SQLite and real sodium encryption because the
 * API-key invariant is about bytes at rest and audited decryptions. If mocks
 * stood in here, plaintext storage could pass while the product breaks trust.
 */
import Database from "better-sqlite3";
import { runMigrations } from "../../src/db/migrations/runner";
import { AuditRepository } from "../../src/db/repositories/audit-repository";
import { VaultRepository } from "../../src/db/repositories/vault-repository";
import { SodiumVaultCrypto } from "../../src/main/security/vault-crypto";

async function createVault() {
  const db = new Database(":memory:");
  runMigrations(db);
  const auditRepository = new AuditRepository(db);
  const crypto = await SodiumVaultCrypto.fromKey(new Uint8Array(32).fill(7));
  const vaultRepository = new VaultRepository(db, crypto, auditRepository);
  return { db, auditRepository, vaultRepository };
}

it("round-trips a key encrypted so plaintext never lands in api_keys", async () => {
  const { db, vaultRepository } = await createVault();

  vaultRepository.add("openai", "sk-phase-one-secret");

  expect(vaultRepository.readSecret("openai", "test-user", "round-trip")).toBe("sk-phase-one-secret");
  const ciphertext = db.prepare("SELECT ciphertext FROM api_keys WHERE source = ?").get("openai") as
    | { ciphertext: string }
    | undefined;
  expect(ciphertext?.ciphertext).toContain("sodium:");
  expect(ciphertext?.ciphertext).not.toContain("sk-phase-one-secret");
});

it("reading a key writes an audit event with sensitivity sensitive because key access is sensitive", async () => {
  const { auditRepository, vaultRepository } = await createVault();
  vaultRepository.add("anthropic", "sk-ant-phase-one-secret");

  expect(vaultRepository.readSecret("anthropic", "test-user", "provider.test")).toBe("sk-ant-phase-one-secret");

  expect(auditRepository.list(10)).toMatchObject([
    {
      actor: "test-user",
      action: "key.read",
      objectType: "api_key",
      objectId: "anthropic",
      sensitivity: "sensitive",
      detail: { source: "anthropic", purpose: "provider.test" }
    }
  ]);
});

it("revoke removes the key and future reads fail closed so stale secrets cannot be reused", async () => {
  const { vaultRepository } = await createVault();
  vaultRepository.add("xai", "xai-phase-one-secret");

  expect(vaultRepository.revoke("xai")).toBe(true);
  expect(() => vaultRepository.readSecret("xai", "test-user", "after-revoke")).toThrow(/No API key is stored/);
});
