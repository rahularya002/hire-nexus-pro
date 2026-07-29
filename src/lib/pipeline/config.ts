// Tunable pipeline constants. Every value can be overridden with an env var so
// thresholds can be retuned without a code change or redeploy.

function num(name: string, fallback: number): number {
  const raw = typeof process !== "undefined" ? process.env?.[name] : undefined;
  const n = raw == null ? NaN : Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** At or above this heuristic score the item is imported without any AI call. */
export const AUTO_IMPORT_THRESHOLD = num("PIPELINE_AUTO_IMPORT_THRESHOLD", 92);
/** At or below this heuristic score the item is skipped without any AI call. */
export const SKIP_THRESHOLD = num("PIPELINE_SKIP_THRESHOLD", 25);

/** Hard caps on what we are willing to send to the model. */
export const AI_MAX_BODY_CHARS = num("PIPELINE_AI_MAX_BODY_CHARS", 1200);
export const AI_MAX_DOC_CHARS = num("PIPELINE_AI_MAX_DOC_CHARS", 3000);

/** Cached AI verdicts older than this are ignored. */
export const CACHE_TTL_DAYS = num("PIPELINE_CACHE_TTL_DAYS", 180);

/** Per-facet deterministic coverage we consider "good enough" to skip the model. */
export const COVERAGE_TARGETS = {
  identity: num("PIPELINE_COVERAGE_IDENTITY", 70),
  contact: num("PIPELINE_COVERAGE_CONTACT", 70),
  experience: num("PIPELINE_COVERAGE_EXPERIENCE", 60),
  skills: num("PIPELINE_COVERAGE_SKILLS", 50),
} as const;

export type Facet = keyof typeof COVERAGE_TARGETS;