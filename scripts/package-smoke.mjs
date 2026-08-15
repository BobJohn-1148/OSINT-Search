/**
 * Packaging smoke checks stay static because CI and reviewer machines may not
 * have a full Windows installer environment. If Phase 12 only trusted a local
 * interactive build, electron-builder wiring could drift without a fast test.
 */
import { existsSync, readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const build = packageJson.build;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(packageJson.devDependencies?.["electron-builder"], "electron-builder dev dependency is missing");
assert(packageJson.scripts?.["package:dir"]?.includes("electron-builder --dir"), "package:dir does not run electron-builder");
assert(packageJson.scripts?.["package:win"]?.includes("electron-builder --win"), "package:win does not run electron-builder");
assert(build?.productName === "Reacher", "builder product name must be Reacher");
assert(build?.win?.target?.includes("nsis"), "Windows NSIS target is missing");
assert(build?.win?.icon === "assets/brand/reacher-icon.ico", "Windows icon must use the Reacher icon set");
assert(existsSync("assets/brand/reacher-icon.ico"), "Reacher Windows icon is missing");

console.log("Packaging smoke checks passed");
