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

  expect(calls).toContainEqual({ command: "adb", args: ["devices", "-l"] });
  expect(calls).toContainEqual({ command: "idevice_id", args: ["-l"] });
  expect(calls).toContainEqual({ command: "ideviceinfo", args: ["-u", "ios-one", "-s", "-k", "DeviceName"] });
  expect(calls).toContainEqual({ command: "ideviceinfo", args: ["-u", "ios-one", "-s", "-k", "ProductType"] });
  expect(result.devices).toMatchObject([
    { id: "android-one", platform: "android", connected: true },
    { id: "ios-one", platform: "ios", connected: true }
  ]);
  expect(result.devices[0]?.dataTypes.map((dataType) => dataType.id)).toContain("android-packages");
  expect(result.toolStatus?.map((tool) => tool.id)).toEqual(["adb", "libimobiledevice"]);
  expect(result.unavailableTools).toEqual([]);
});

it("reports missing mobile tools without crashing so unplugged workstations still render the tab", async () => {
  const runner: MobileCommandRunner = () => Promise.reject(new Error("missing"));

  const result = await new MobileService(runner).detect();

  expect(result).toMatchObject({
    devices: [],
    unavailableTools: ["adb", "libimobiledevice"],
    hostUsbDevices: []
  });
  expect(result.toolStatus?.every((tool) => !tool.available)).toBe(true);
});

it("collects selected Android metadata through fixed adb recipes scoped to the chosen device", async () => {
  const calls: { readonly command: string; readonly args: readonly string[] }[] = [];
  const runner: MobileCommandRunner = (command, args) => {
    calls.push({ command, args });
    if (args.includes("getprop")) {
      return Promise.resolve({ stdout: "[ro.product.model]: [Pixel 8]\n[ro.build.version.release]: [15]\n", stderr: "" });
    }
    return Promise.resolve({ stdout: "package:/data/app/example/base.apk=com.example.app\n", stderr: "" });
  };

  const result = await new MobileService(runner).collect({
    deviceId: "android-one",
    platform: "android",
    dataTypeIds: ["android-device-info", "android-packages"]
  });

  expect(calls).toContainEqual({ command: "adb", args: ["-s", "android-one", "shell", "getprop"] });
  expect(calls).toContainEqual({ command: "adb", args: ["-s", "android-one", "shell", "pm", "list", "packages", "-f"] });
  expect(result.results.map((item) => item.status)).toEqual(["passed", "passed"]);
  expect(result.results[0]?.stdout).toContain("Pixel 8");
});

it("collects iOS inventory and marks artifact-only categories as skipped until export paths exist", async () => {
  const calls: { readonly command: string; readonly args: readonly string[] }[] = [];
  const runner: MobileCommandRunner = (command, args) => {
    calls.push({ command, args });
    return Promise.resolve({ stdout: "ProductType: iPhone16,2\nProductVersion: 18.6\n", stderr: "" });
  };

  const result = await new MobileService(runner).collect({
    deviceId: "ios-one",
    platform: "ios",
    dataTypeIds: ["ios-device-info", "ios-screenshot"]
  });

  expect(calls).toContainEqual({ command: "ideviceinfo", args: ["-u", "ios-one"] });
  expect(result.results[0]).toMatchObject({ dataTypeId: "ios-device-info", status: "passed" });
  expect(result.results[1]).toMatchObject({ dataTypeId: "ios-screenshot", status: "skipped" });
});
