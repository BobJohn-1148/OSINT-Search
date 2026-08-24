/**
 * PCAP parsing consumes tshark JSON from an imported file because live capture
 * would require elevated helpers and belongs outside Phase 9. If a live capture
 * flag appeared here, Reacher could start sniffing without explicit packaging.
 */
import type { PcapConversation } from "../../shared/schemas/analyzers.js";

interface PacketShape {
  readonly _source?: {
    readonly layers?: Record<string, unknown>;
  };
}

export function buildTsharkArgv(filePath: string): string[] {
  return ["tshark", "-r", filePath, "-T", "json"];
}

/**
 * tshark's own JSON output is a top-level array only on the happy path.
 * Confirmed by direct testing: an empty capture produces empty stdout (a
 * JSON.parse syntax error, not an empty array), and a failed/rejected
 * capture reports a single `{"error": "..."}` object instead -- both throw
 * an unguarded `for...of` "not iterable" error identical in kind to the EVTX
 * parser crash found earlier, if trusted without a shape check first.
 */
export function parseTsharkJson(json: string): PcapConversation[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("tshark produced no parseable JSON output -- the capture may be empty or tshark may have failed silently");
  }
  if (!Array.isArray(parsed)) {
    const reported = objectValue(parsed).error;
    throw new Error(
      typeof reported === "string"
        ? `tshark reported an error instead of packet data: ${reported}`
        : `tshark output was not a JSON array of packets -- got ${parsed === null ? "null" : typeof parsed}`
    );
  }
  const packets = parsed as PacketShape[];
  const conversations = new Map<string, PcapConversation>();
  for (const packet of packets) {
    const layers = packet._source?.layers ?? {};
    const source = firstLayerValue(layers, ["ip.src", "ipv6.src", "eth.src"]);
    const destination = firstLayerValue(layers, ["ip.dst", "ipv6.dst", "eth.dst"]);
    const protocol = firstLayerValue(layers, ["_ws.col.Protocol"]) || "unknown";
    const bytes = Number(firstLayerValue(layers, ["frame.len"])) || 0;
    if (!source || !destination) {
      continue;
    }
    const key = `${source}|${destination}|${protocol}`;
    const existing = conversations.get(key) ?? { source, destination, protocol, packets: 0, bytes: 0 };
    conversations.set(key, { ...existing, packets: existing.packets + 1, bytes: existing.bytes + bytes });
  }
  return [...conversations.values()].sort((a, b) => b.packets - a.packets || a.source.localeCompare(b.source));
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function firstLayerValue(layers: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = layers[key];
    if (typeof value === "string") {
      return value;
    }
    if (Array.isArray(value) && typeof value[0] === "string") {
      return value[0];
    }
  }
  return "";
}
