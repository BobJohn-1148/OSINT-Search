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

// The ScrapeGraph worker resolves itself under resourcesPath/scripts in a
// packaged build. build.files only ships dist/, so without an extraResources
// entry the source works in dev and dies in the installer -- the failure mode
// nobody catches, because nobody runs the packaged app against a domain seed.
const workerResource = build?.extraResources?.find((entry) => entry.to === "scripts");
assert(workerResource, "scripts/ must ship as extraResources or the ScrapeGraph worker is missing from packaged builds");
assert(
  !workerResource.filter || workerResource.filter.includes("scrapegraph-osint.py"),
  "the packaged scripts/ filter must include scrapegraph-osint.py"
);
assert(existsSync("scripts/scrapegraph-osint.py"), "ScrapeGraph worker script is missing from the repo");

console.log("Packaging smoke checks passed");
