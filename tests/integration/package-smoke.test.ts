/**
 * Packaging smoke tests verify builder wiring without producing an installer on
 * every test run. If the config is not checked in tests, Phase 12 could pass
 * source audits while the Windows build entrypoints silently disappear.
 */
import { execFileSync } from "node:child_process";

it("packaging smoke test verifies electron-builder config so Windows build remains wired", () => {
  const output = execFileSync(process.execPath, ["scripts/package-smoke.mjs"], { encoding: "utf8" });
  expect(output).toContain("Packaging smoke checks passed");
});
