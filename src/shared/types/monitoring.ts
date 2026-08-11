/**
 * Monitoring target types are narrow because breach checks carry privacy risk.
 * If arbitrary strings became watch kinds, sources and scheduler policy would
 * not know whether a target can be checked passively or needs a paid domain key.
 */
export const watchTargetTypeValues = ["email", "domain"] as const;
export type WatchTargetType = (typeof watchTargetTypeValues)[number];
