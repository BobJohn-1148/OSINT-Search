/**
 * EVTX parsing consumes wevtutil XML because Windows event logs are structured
 * evidence, not terminal text. If the UI parsed event strings itself, filters
 * could disagree with saved findings and reports.
 */
import { XMLParser } from "fast-xml-parser";
import type { EvtxEvent } from "../../shared/schemas/analyzers.js";
import type { EvtxLevel } from "../../shared/types/analyzers.js";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
const levelMap: Record<number, EvtxLevel> = {
  1: "critical",
  2: "error",
  3: "warning",
  4: "information",
  5: "verbose"
};

export function parseEvtxXml(xml: string): EvtxEvent[] {
  const wrapped = `<Events>${xml.replace(/<\?xml[^>]*>/g, "")}</Events>`;
  const parsed = parser.parse(wrapped) as Record<string, unknown>;
  return arrayValue(objectValue(parsed.Events).Event).map(toEvent);
}

export function filterEvtxEvents(events: readonly EvtxEvent[], filter: {
  readonly eventId?: number;
  readonly provider?: string;
  readonly level?: EvtxLevel;
}): EvtxEvent[] {
  return events.filter(
    (event) =>
      (filter.eventId === undefined || event.eventId === filter.eventId) &&
      (filter.provider === undefined || event.provider === filter.provider) &&
      (filter.level === undefined || event.level === filter.level)
  );
}

function toEvent(value: unknown): EvtxEvent {
  const event = objectValue(value);
  const system = objectValue(event.System);
  const provider = objectValue(system.Provider);
  const rendering = objectValue(event.RenderingInfo);
  const levelNumber = numberValue(system.Level);
  return {
    eventId: numberValue(system.EventID),
    provider: stringValue(provider.Name),
    level: levelMap[levelNumber] ?? "unknown",
    timestamp: stringValue(objectValue(system.TimeCreated).SystemTime),
    message: stringValue(rendering.Message) || stringValue(event.EventData)
  };
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
}

function stringValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}
