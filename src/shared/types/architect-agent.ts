/**
 * Architect agent types stay separate from OSINT run types because this agent
 * reasons about code changes, not investigation seeds. If both flows shared one
 * run shape, a confirm-gated code plan could look like an OSINT finding.
 */
export const architectActionValues = ["ask", "proposePlan", "apply"] as const;

export type ArchitectAction = (typeof architectActionValues)[number];

export interface ArchitectPlanStep {
  readonly title: string;
  readonly files: readonly string[];
  readonly reason: string;
}
