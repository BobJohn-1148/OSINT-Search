import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

it("builds the preload as CommonJS without bare import statements", () => {
  execFileSync(process.execPath, [
    "node_modules/esbuild/bin/esbuild",
    "src/preload/preload.ts",
    "--bundle",
    "--platform=node",
    "--format=cjs",
    "--external:electron",
    "--outfile=dist/preload/preload.cjs"
  ], { stdio: "pipe" });

  const preloadBundlePath = path.join("dist", "preload", "preload.cjs");
  expect(existsSync(preloadBundlePath)).toBe(true);

  const preloadBundle = readFileSync(preloadBundlePath, "utf8");
  expect(preloadBundle).not.toMatch(/^\s*import\s/m);
});
