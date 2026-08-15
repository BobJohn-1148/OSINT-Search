/**
 * Ping audit tests prove the first renderer-callable stub action writes through
 * the repository and append-only table. If this route used a shortcut, later
 * sensitive actions would lack a working audited IPC example.
 */
import Database from "better-sqlite3";
import { runMigrations } from "../../src/db/migrations/runner";
import { AuditRepository } from "../../src/db/repositories/audit-repository";
import { createSystemHandlers } from "../../src/main/ipc/handlers/system-handlers";

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
