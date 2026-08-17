/**
 * The main process loads project-local env files because Electron does not get
 * Vite's renderer env handling. Keep this tiny and non-logging so secrets never
 * appear in diagnostics.
 */
import { existsSync, readFileSync } from "node:fs";

export function loadLocalEnv(envPath: string): void {
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (parsed === null || process.env[parsed.name]) {
      continue;
    }
    process.env[parsed.name] = parsed.value;
  }
}

function parseEnvLine(line: string): { readonly name: string; readonly value: string } | null {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.startsWith("#")) {
    return null;
  }

  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex <= 0) {
    return null;
  }

  const name = trimmed.slice(0, separatorIndex).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    return null;
  }

  return { name, value: unquoteEnvValue(trimmed.slice(separatorIndex + 1).trim()) };
}

function unquoteEnvValue(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replaceAll("\\n", "\n").replaceAll('\\"', '"');
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  return value;
}
