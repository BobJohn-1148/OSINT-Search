/**
 * The nmap parser turns XML stdout into normalized host/service rows before
 * persistence so reports never depend on renderer parsing. If raw XML were read
 * directly by UI code, malformed output could create different topology and
 * report views for the same scan.
 */
import { XMLParser } from "fast-xml-parser";
import type { ScanHost, ScanPort } from "../../shared/schemas/scans.js";

interface ParsedHost {
  readonly address: string;
  readonly hostname: string | null;
  readonly status: string;
  readonly hopDistance: number;
  readonly ports: readonly Omit<ScanPort, "id" | "scanId" | "hostId">[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  allowBooleanAttributes: true
});

export function parseNmapXml(xml: string): ParsedHost[] {
  if (!xml.trim()) {
    return [];
  }
  const parsed = parser.parse(xml) as Record<string, unknown>;
  const nmaprun = objectValue(parsed.nmaprun);
  const hosts = arrayValue(nmaprun.host);
  return hosts
    .map(parseHost)
    .filter((host): host is ParsedHost => Boolean(host))
    .sort((a, b) => a.hopDistance - b.hopDistance || a.address.localeCompare(b.address));
}

export function toPortsByAddress(hosts: readonly ParsedHost[]): ReadonlyMap<string, readonly Omit<ScanPort, "id" | "scanId" | "hostId">[]> {
  return new Map(hosts.map((host) => [host.address, host.ports]));
}

export function toRepositoryHosts(hosts: readonly ParsedHost[]): readonly Omit<ScanHost, "id" | "scanId" | "ports">[] {
  return hosts.map((host) => ({
    address: host.address,
    hostname: host.hostname,
    status: host.status,
    hopDistance: host.hopDistance
  }));
}

function parseHost(value: unknown): ParsedHost | null {
  const host = objectValue(value);
  const address = firstAddress(host.address);
  if (!address) {
    return null;
  }
  const hostname = firstHostname(host.hostnames);
  const status = stringValue(objectValue(host.status).state) || "unknown";
  const hopDistance = hopDistanceFromTrace(host.trace) ?? 1;
  return {
    address,
    hostname,
    status,
    hopDistance,
    ports: arrayValue(objectValue(host.ports).port).map(parsePort).sort((a, b) => a.port - b.port)
  };
}

function parsePort(value: unknown): Omit<ScanPort, "id" | "scanId" | "hostId"> {
  const port = objectValue(value);
  const service = objectValue(port.service);
  return {
    protocol: stringValue(port.protocol) || "tcp",
    port: numberValue(port.portid),
    state: stringValue(objectValue(port.state).state) || "unknown",
    service: stringValue(service.name),
    product: stringValue(service.product),
    version: stringValue(service.version)
  };
}

function firstAddress(value: unknown): string | null {
  const address = arrayValue(value).find((entry) => stringValue(objectValue(entry).addr));
  return address ? stringValue(objectValue(address).addr) : null;
}

function firstHostname(value: unknown): string | null {
  const hostnames = objectValue(value);
  const hostname = arrayValue(hostnames.hostname).find((entry) => stringValue(objectValue(entry).name));
  return hostname ? stringValue(objectValue(hostname).name) : null;
}

function hopDistanceFromTrace(value: unknown): number | null {
  const hops = arrayValue(objectValue(value).hop);
  if (hops.length === 0) {
    return null;
  }
  const ttlValues = hops.map((hop) => numberValue(objectValue(hop).ttl)).filter((ttl) => ttl > 0);
  return ttlValues.length > 0 ? Math.max(...ttlValues) : hops.length;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayValue(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  return value === undefined || value === null ? [] : [value];
}

function stringValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}
