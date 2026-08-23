/**
 * Shared metric primitives so every insight panel counts the same way. If the
 * agents surface and the dashboard each rolled their own tally and median, two
 * panels could report different numbers for the same rows and there would be no
 * single place to prove which one is right.
 */
export interface DistributionSlice {
  readonly label: string;
  readonly count: number;
  readonly share: number;
}

export function tally(values: readonly string[]): DistributionSlice[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const total = values.length;
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count, share: total === 0 ? 0 : count / total }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

export function median(values: readonly number[]): number | null {
  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.length === 0) {
    return null;
  }
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Elapsed milliseconds between two ISO stamps, or null when either is unusable. */
export function elapsedMs(startTs: string, endTs: string | null): number | null {
  if (endTs === null) {
    return null;
  }
  const elapsed = Date.parse(endTs) - Date.parse(startTs);
  return Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : null;
}

export function formatDuration(durationMs: number | null): string {
  if (durationMs === null) {
    return "—";
  }
  if (durationMs < 1000) {
    return `${Math.round(durationMs)}ms`;
  }
  if (durationMs < 60_000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  }
  return `${Math.round(durationMs / 60_000)}m`;
}

export function formatShare(share: number | null): string {
  return share === null ? "—" : `${Math.round(share * 100)}%`;
}
