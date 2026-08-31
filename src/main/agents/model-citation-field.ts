/**
 * Extracted out of agent-runtime-service.ts so pattern-analysis-service.ts does
 * not have to rediscover the same failure modes a live llama3.1:8b run already
 * proved out: a citation-array field coming back as a single comma-joined
 * string instead of a JSON array (2 of 3 attempts on one real IP-seed run), and
 * a key wrapped in copied prompt formatting (`KEY="observation:...:0"`, quotes
 * and label included). Both agents ask the model for a list of exact citation
 * keys -- "sources" for a finding, "observationIds" for a pattern -- so both
 * get the same tolerance for the same small-model mistakes, one proven parser
 * instead of two copies that could drift.
 */
import { z } from "zod";

function cleanCitationToken(value: string): string {
  return value
    .trim()
    .replace(/^key\s*=\s*/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

export const citationArrayField = z
  .union([z.array(z.string().min(1)), z.string().min(1)])
  .optional()
  .transform((value) => (Array.isArray(value) ? value : value ? [value] : []))
  .transform((values) => values.map(cleanCitationToken).filter((value) => value.length > 0));
