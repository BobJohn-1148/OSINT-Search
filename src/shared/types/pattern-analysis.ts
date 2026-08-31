/**
 * Pattern types are a closed enum, not free text, so the renderer can render a
 * consistent badge per kind and the model cannot invent a category that means
 * nothing to either surface. The four values are the cross-cutting signals a
 * case's existing cited evidence can actually support without adding a new
 * fact: the same identifier turning up more than once, several events landing
 * in a tight time window, several locations clustering together, and two
 * sources disagreeing about the same thing.
 */
export const patternTypeValues = ["recurring_identifier", "temporal_cluster", "geographic_cluster", "contradiction"] as const;

export type PatternType = (typeof patternTypeValues)[number];
