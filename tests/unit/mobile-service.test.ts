/**
 * Mobile service tests use a fake command runner because the security property
 * is fixed argv and graceful missing-tool behavior, not whether this workstation
 * currently has a phone attached.
 */
import { MobileService } from "../../src/main/mobile/mobile-service";
import type { MobileCommandRunner } from "../../src/main/mobile/mobile-service";

it("detects Android and iOS devices through fixed local probes so phone inventory stays main-owned", async () => {
  const calls: { readonly command: string; readonly args: readonly string[] }[] = [];
  const runner: MobileCommandRunner = (command, args) => {
    calls.push({ command, args });
    if (command === "adb") {
      return Promise.resolve({ stdout: "List of devices attached\r\nandroid-one device product:pixel model:Pixel_8\r\n", stderr: "" });
    }
    return Promise.resolve({ stdout: "ios-one\n", stderr: "" });
  };

  const result = await new MobileService(runner).detect();

  expect(calls).toEqual([
    { command: "adb", args: ["devices", "-l"] },
    { command: "idevice_id", args: ["-l"] }
  ]);
  expect(result.devices).toMatchObject([
    { id: "android-one", platform: "android", connected: true },
    { id: "ios-one", platform: "ios", connected: true }
  ]);
  expect(result.devices[0]?.dataTypes.map((dataType) => dataType.id)).toContain("android-packages");
  expect(result.unavailableTools).toEqual([]);
});

it("reports missing mobile tools without crashing so unplugged workstations still render the tab", async () => {
  const runner: MobileCommandRunner = () => Promise.reject(new Error("missing"));

  await expect(new MobileService(runner).detect()).resolves.toEqual({
    devices: [],
    unavailableTools: ["adb", "libimobiledevice"]
  });
});
