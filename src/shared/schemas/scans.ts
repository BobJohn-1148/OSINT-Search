/**
 * Scan schemas make active network scans a typed IPC contract because the same
 * target string must drive local nmap argv, parsed hosts, topology, and report
 * export. If each layer shaped scans independently, CIDR widening or uncited
 * reports could slip in unnoticed.
 */
import { z } from "zod";
import { scanStatusValues, scanTimingValues, scanTypeValues } from "../types/scans.js";

export const scanOptionSchema = z.object({
  scanType: z.enum(scanTypeValues),
  timing: z.enum(scanTimingValues),
  ports: z.string().min(1).optional(),
  customArgs: z.array(z.string().min(1)).default([]),
  skipHostDiscovery: z.boolean().default(false),
  serviceVersion: z.boolean().default(false),
  osDetect: z.boolean().default(false),
  vulnScripts: z.boolean().default(false)
});

export const scanRecordSchema = z.object({
  id: z.string().min(1),
  target: z.string().min(1),
  wslDistro: z.string().min(1),
  status: z.enum(scanStatusValues),
  scanType: z.enum(scanTypeValues),
  timing: z.enum(scanTimingValues),
  argv: z.array(z.string().min(1)),
  stdout: z.string(),
  stderr: z.string(),
  startedTs: z.string().min(1),
  completedTs: z.string().min(1).nullable(),
  authorizationId: z.string().min(1).nullable()
});

export const scanPortSchema = z.object({
  id: z.string().min(1),
  scanId: z.string().min(1),
  hostId: z.string().min(1),
  protocol: z.string().min(1),
  port: z.number().int().min(0),
  state: z.string().min(1),
  service: z.string(),
  product: z.string(),
  version: z.string()
});

export const scanHostSchema = z.object({
  id: z.string().min(1),
  scanId: z.string().min(1),
  address: z.string().min(1),
  hostname: z.string().nullable(),
  status: z.string().min(1),
  hopDistance: z.number().int().min(1),
  ports: z.array(scanPortSchema)
});

export const topologyNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  x: z.number(),
  y: z.number(),
  ring: z.number().int().min(0)
});

export const topologyEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1)
});

export const scanTopologySchema = z.object({
  scanId: z.string().min(1),
  nodes: z.array(topologyNodeSchema),
  edges: z.array(topologyEdgeSchema)
});

export const scanRunRequestSchema = z.object({
  target: z.string().min(1),
  options: scanOptionSchema
});
export const scanRunResponseSchema = z.object({
  scan: scanRecordSchema,
  hosts: z.array(scanHostSchema),
  topology: scanTopologySchema
});

export const scanGetRequestSchema = z.object({ scanId: z.string().min(1) });
export const scanGetResponseSchema = z.object({
  scan: scanRecordSchema.nullable(),
  hosts: z.array(scanHostSchema)
});

export const scanTopologyRequestSchema = z.object({ scanId: z.string().min(1) });
export const scanTopologyResponseSchema = z.object({ topology: scanTopologySchema });

export const scanOutputEventSchema = z.object({
  scanId: z.string().min(1),
  stream: z.enum(["stdout", "stderr"]),
  chunk: z.string()
});

export type ScanOptions = z.infer<typeof scanOptionSchema>;
export type ScanRecord = z.infer<typeof scanRecordSchema>;
export type ScanHost = z.infer<typeof scanHostSchema>;
export type ScanPort = z.infer<typeof scanPortSchema>;
export type ScanTopology = z.infer<typeof scanTopologySchema>;
export type ScanOutputEvent = z.infer<typeof scanOutputEventSchema>;
export type ScanRunRequest = z.infer<typeof scanRunRequestSchema>;
export type ScanRunResponse = z.infer<typeof scanRunResponseSchema>;
export type ScanGetRequest = z.infer<typeof scanGetRequestSchema>;
export type ScanGetResponse = z.infer<typeof scanGetResponseSchema>;
export type ScanTopologyRequest = z.infer<typeof scanTopologyRequestSchema>;
export type ScanTopologyResponse = z.infer<typeof scanTopologyResponseSchema>;
