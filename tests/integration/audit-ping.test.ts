/**
 * Ping audit tests prove the first renderer-callable stub action writes through
 * the repository and append-only table. If this route used a shortcut, later
 * sensitive actions would lack a working audited IPC example.
 */
import Database from "better-sqlite3";
import { runMigrations } from "../../src/db/migrations/runner";
import { AuditRepository } from "../../src/db/repositories/audit-repository";
import { createSystemHandlers, isUsableLocalIpv4 } from "../../src/main/ipc/handlers/system-handlers";

it("records an audit event on ping so stub actions are observable", () => {
  const db = new Database(":memory:");
  runMigrations(db);
  const auditRepository = new AuditRepository(db);
  const handlers = createSystemHandlers(auditRepository);

  expect(handlers["system:ping"]({ nonce: "dashboard" })).toEqual({
    pong: true,
    nonce: "dashboard",
    audited: true
  });

  expect(auditRepository.list(10)).toMatchObject([
    {
      actor: "local-user",
      action: "system.ping",
      objectType: "system",
      objectId: "reacher",
      sensitivity: "low",
      detail: { nonce: "dashboard" }
    }
  ]);
});

it("filters APIPA and loopback addresses out of local scan choices so network scans default to real LANs", () => {
  expect(isUsableLocalIpv4("10.0.0.16")).toBe(true);
  expect(isUsableLocalIpv4("192.168.1.20")).toBe(true);
  expect(isUsableLocalIpv4("172.16.4.5")).toBe(true);
  expect(isUsableLocalIpv4("169.254.198.172")).toBe(false);
  expect(isUsableLocalIpv4("127.0.0.1")).toBe(false);
  expect(isUsableLocalIpv4("0.0.0.0")).toBe(false);
});
