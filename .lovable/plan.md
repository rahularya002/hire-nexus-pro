## Revised plan — Email Archive cost architecture

Incorporating all six pieces of feedback. Notably: **enrichment is never automatic**, thresholds are named constants, and the pipeline is restructured into named stages so future importers reuse it.

Unchanged correction from before: resume text extraction is already AI-free (`unpdf` + `mammoth` in `src/lib/cv-parse.server.ts`), and there is one LLM call per email, not two — `classifyEmail` classifies and extracts in a single Gemini 2.5 Flash request.

## Stage architecture

Restructure into four named stages, each with one responsibility, so LinkedIn / Drive / ATS importers can later plug in at Discovery:

```text
DISCOVERY      Gmail → RawItem { source, external_id, metadata, attachments }
NORMALIZATION  hash attachments → text extraction → deterministic field extraction
CLASSIFICATION rules → bands → (cache lookup) → Gemini only when ambiguous
ENRICHMENT     never during import; on explicit demand only
```

New file layout:
- `src/lib/pipeline/types.ts` — `RawItem`, `NormalizedItem`, `ClassifiedItem`, `FieldCoverage`
- `src/lib/pipeline/normalize.server.ts` — hashing, text extraction, deterministic extraction
- `src/lib/pipeline/classify.server.ts` — rules, bands, cache, Gemini fallback
- `src/lib/pipeline/config.ts` — all tunable constants
- `src/lib/gmail-discovery.server.ts` — Gmail → `RawItem` (the only Gmail-specific file)
- `src/lib/email-import.server.ts` becomes a thin orchestrator

## 1. Tunable configuration (`pipeline/config.ts`)

```ts
export const AUTO_IMPORT_THRESHOLD = 92;
export const SKIP_THRESHOLD = 25;
export const AI_MAX_BODY_CHARS = 1200;
export const AI_MAX_DOC_CHARS = 3000;
export const CACHE_TTL_DAYS = 180;
export const COVERAGE_TARGETS = { identity: 70, contact: 70, experience: 60, skills: 50 };
```

Each constant reads an optional `process.env` override at module load, so thresholds can be tuned without a code change.

## 2. Deterministic extraction with per-facet coverage

`normalize.server.ts` extracts from plain text via regex/rules and returns fields plus a `FieldCoverage` breakdown instead of a single score:

| Facet | Extracted from | Typical hit rate |
|---|---|---|
| contact | email regex, phone regex (IN + intl), LinkedIn URL | very high |
| identity | header lines, filename fallback, email local-part | high |
| experience | "X years", date-range summing, company keywords near "at/@" | medium |
| skills | curated dictionary match against the text | medium |

AI is then asked **only for the facets below their target** — the tool schema is built dynamically from the gaps, so a resume missing only skills sends a one-property schema.

## 3. Classification bands

- `score >= AUTO_IMPORT_THRESHOLD` → import, no AI. Gated on resume-structured document text plus a contact detail.
- `score <= SKIP_THRESHOLD` → skip, logged to `email_import_skips` (today's cutoff is 12, so a lot of junk currently reaches Gemini).
- otherwise → cache lookup, then Gemini.

## 4. Two-level cache (resume hash **and** email hash)

Migration adds:
- `content_sha256` on `email_resume_versions`, indexed on `(user_id, content_sha256)`
- `ai_cache` table: `user_id`, `cache_key` (SHA-256), `kind` (`resume` | `email`), `payload jsonb` (extracted text, fields, classification verdict), `created_at`, unique on `(user_id, cache_key)`

Keys:
- **Resume key** — SHA-256 of the attachment bytes. Hit skips parsing *and* classification.
- **Email key** — SHA-256 of `from_email | subject | resume hashes | cleaned-body prefix`. Hit means the exact same prompt would be sent, so the stored verdict is reused. This makes `rescoreArchive` almost free on unchanged mail.

Invalidation: a changed attachment or changed body produces a different key naturally; entries older than `CACHE_TTL_DAYS` are ignored.

## 5. Body preprocessing

New helper strips HTML, quoted replies (`On … wrote:`, `>` blocks, `-----Original Message-----`), signature blocks, legal/confidentiality disclaimers, tracking pixels and unsubscribe footers, then truncates to `AI_MAX_BODY_CHARS`. Document text is capped at `AI_MAX_DOC_CHARS` — identity fields live in the resume header, not in project history.

## 6. Enrichment — explicit only

No enrichment during import. No enrichment on profile open. A new `enrichArchivePerson` server function runs only when:
1. the recruiter clicks **Generate AI summary** in the person sheet,
2. the person is matched against a JD,
3. an AI-powered search touches them.

`email_candidates` gets `enriched_at` and `ai_summary` so the result persists and never re-runs on its own. The person sheet shows deterministic fields immediately with a "Generate AI summary" call-to-action where the summary would be.

## 7. Instrumentation

`email_import_runs` gains `ai_calls`, `cache_hits`, `auto_imported`, `tokens_estimated`. The run card in `src/routes/email-archive.tsx` shows the funnel:

```text
6,000 scanned → 5,890 skipped by rules → 51 cache hits → 74 AI calls
```

## Not in this plan

The local ONNX classifier before Gemini — agreed it's the right v2 move, but it isn't worth the model-hosting and bundle weight until the funnel metrics from step 7 show the 26–91 band is actually large.

## Technical notes

- Hashing uses Web Crypto (`crypto.subtle.digest`), available in the Worker runtime — no new dependency.
- Files touched: `src/lib/email-import.server.ts`, `src/lib/email-import.functions.ts`, `src/lib/recruitment-classify.server.ts` (logic moves into `pipeline/classify.server.ts`, file kept as a re-export so existing imports don't break), `src/lib/gmail.server.ts`, `src/routes/email-archive.tsx`; new `src/lib/pipeline/*`; one migration.
- `unpdf` / `mammoth` stay as-is. Tika / Docling are JVM- and Python-based and cannot run in this runtime.
- Existing archive rows are untouched; the cache starts cold and fills on the next run.
