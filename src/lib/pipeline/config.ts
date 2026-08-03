// Tunable pipeline constants. Every value can be overridden with an env var so
// thresholds can be retuned without a code change or redeploy.

function num(name: string, fallback: number): number {
  const raw = typeof process !== "undefined" ? process.env?.[name] : undefined;
  const n = raw == null ? NaN : Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** At or above this candidate-confidence the item is imported without any AI call. */
export const CANDIDATE_IMPORT_THRESHOLD = num("PIPELINE_CANDIDATE_IMPORT_THRESHOLD", 75);
/** At or below this candidate-confidence there is no candidate worth chasing. */
export const CANDIDATE_SKIP_THRESHOLD = num("PIPELINE_CANDIDATE_SKIP_THRESHOLD", 25);
/**
 * At or above this candidate-confidence we trust the verdict outright and import
 * without asking a recruiter, even when the extraction is partial or the
 * evidence carried a soft uncertainty note. Keeps the review queue small enough
 * for a human to actually clear.
 */
export const CANDIDATE_AUTO_ACCEPT_THRESHOLD = num("PIPELINE_CANDIDATE_AUTO_ACCEPT_THRESHOLD", 85);

/** Legacy aliases — recruitment-noise gating still uses these bands. */
export const AUTO_IMPORT_THRESHOLD = num("PIPELINE_AUTO_IMPORT_THRESHOLD", 92);
export const SKIP_THRESHOLD = num("PIPELINE_SKIP_THRESHOLD", 25);

/** Hard caps on what we are willing to send to the model. */
export const AI_MAX_BODY_CHARS = num("PIPELINE_AI_MAX_BODY_CHARS", 1200);
export const AI_MAX_DOC_CHARS = num("PIPELINE_AI_MAX_DOC_CHARS", 3000);

/** Cached AI verdicts older than this are ignored. */
export const CACHE_TTL_DAYS = num("PIPELINE_CACHE_TTL_DAYS", 180);

/** Emails listed per Gmail page. */
export const BATCH_SIZE = num("PIPELINE_BATCH_SIZE", 50);
/** How many Gmail pages one server round trip consumes. */
export const PAGES_PER_BATCH = num("PIPELINE_PAGES_PER_BATCH", 2);
/** How many emails are prepared (Gmail + parse + classify) concurrently. */
export const MESSAGE_CONCURRENCY = num("PIPELINE_MESSAGE_CONCURRENCY", 16);
/** How many distinct people are written to the database concurrently. */
export const WRITE_CONCURRENCY = num("PIPELINE_WRITE_CONCURRENCY", 6);

/** Per-facet deterministic coverage we consider "good enough" to skip the model. */
export const COVERAGE_TARGETS = {
  identity: num("PIPELINE_COVERAGE_IDENTITY", 70),
  contact: num("PIPELINE_COVERAGE_CONTACT", 70),
  experience: num("PIPELINE_COVERAGE_EXPERIENCE", 60),
  skills: num("PIPELINE_COVERAGE_SKILLS", 50),
} as const;

export type Facet = keyof typeof COVERAGE_TARGETS;