#!/usr/bin/env node
/**
 * Runs the real search orchestrator against live external APIs (no mocks,
 * no stubs) for a handful of seed types, and prints the full raw data each
 * connector returned. Kept as a standing dev script, not a throwaway, so
 * "does OSINT search still actually work" can be re-checked after any change
 * to a connector or the orchestrator without needing the full Electron app.
 *
 * Usage (run from the project root): npx tsx scripts/verify-search-live.mjs
 * Plain `node` cannot run this file directly -- it imports .ts source files,
 * which only tsx's loader knows how to resolve and transpile on the fly.
 */
import { runSearch } from "../src/main/search/orchestrator.ts";
import { searchConnectors } from "../src/main/search/connectors/index.js";

async function runFor(seed) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`Seed: ${seed.type} = ${seed.value}`);
  console.log("=".repeat(70));
  const start = Date.now();
  const result = await runSearch({ seed, connectors: searchConnectors, connectorTimeoutMs: 15000 });
  console.log(`Took ${Date.now() - start}ms\n`);

  console.log("Source statuses:");
  for (const status of result.statuses) {
    const marker = status.status === "returned" ? "OK  " : "FAIL";
    console.log(`  ${marker} ${status.sourceId.padEnd(20)} observations=${status.observationCount}${status.error ? " error=" + status.error : ""}`);
  }

  console.log(`\nFull data (${result.observations.length} total), grouped by source:`);
  const bySource = new Map();
  for (const observation of result.observations) {
    if (!bySource.has(observation.source)) {
      bySource.set(observation.source, []);
    }
    bySource.get(observation.source).push(observation);
  }
  for (const [source, items] of bySource) {
    console.log(`\n  --- ${source} (${items.length}) ---`);
    for (const item of items) {
      console.log(`  ${item.entity} | ${item.type} = ${JSON.stringify(item.value)}`);
    }
  }
  return result;
}

const seeds = [
  { type: "domain", value: "cloudflare.com" },
  { type: "ip", value: "1.1.1.1" },
  { type: "username", value: "torvalds" },
  { type: "email", value: "test@example.com" },
  { type: "phone", value: "+14155552671" }
];

for (const seed of seeds) {
  await runFor(seed);
}
