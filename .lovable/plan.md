# Search-First Recruitment Memory (Gmail query-driven candidate discovery)

## What changes for the recruiter

Today `/email-archive` is an importer: connect Gmail, run a full backfill, then browse what was imported. The new primary experience is a search box: type "Find fashion designers with 3+ years experience in Delhi or Mumbai", we fetch only the Gmail messages that could match, extract candidates from them, rank them, show evidence (source email + resume), and you tick the ones to add to the permanent candidate database. The existing backfill importer stays, demoted to an optional "Historical backfill" panel.

## What gets reused unchanged

The whole processing pipeline already fits a query-driven flow — only discovery changes.

- `src/lib/gmail.server.ts` — `listMessageIds`, `getMessage`, `getAttachmentBytes`, `getBodyText`, header/address parsing, and the noise heuristics (`senderLooksAutomated`, `preferResumeAttachments`, `messageLooksLikeResumeEmail`). Reused as-is. `buildQuery` stays for the backfill; search gets its own builder.
- `src/lib/gmail-discovery.server.ts` — `gmailMessageToRawItem` (source-agnostic `RawItem`).
- `src/lib/pipeline/normalize.server.ts` — `cleanBodyText`, `extractDeterministic`, `mergeFields`, `sha256Bytes`. Deterministic extraction stays the default.
- `src/lib/pipeline/classify.server.ts` — `classifyItem` bands (rules-import / rules-skip / cache / ai) used verbatim for search hits.
- `src/lib/pipeline/cache.server.ts` + `ai_cache` — `resumeCacheKey`/`emailCacheKey` mean a message already processed by the backfill (or a previous search) costs zero AI.
- `src/lib/cv-parse.server.ts` — resume text extraction, incl. the 8 MB cap.
- `src/lib/email-import.server.ts` — `upsertPersonFromPayload`, `pool()`, and resume-text reuse by `content_sha256`. `upsertPersonFromPayload` is what "save this search hit" calls.
- `src/lib/email-import.functions.ts` — `getArchiveResumeUrl`, `getEmailCandidate`, `promoteArchivePerson`, `enrichArchivePerson`, `listGmailLabels` reused directly by search results.
- `src/lib/google-calendar.server.ts` — `getValidAccessToken` (incl. `invalid_grant` cleanup) and the `gmail.readonly` scope check. OAuth flow untouched.
- `src/components/email-archive/person-sheet.tsx`, `shared.tsx` — evidence/detail rendering.

## What stays untouched

`startImportRun`, `processImportBatch`, `processRunBatch`, `getImportProgress`, `resume/cancel/stopImportRun`, `clearEmailArchive`, `retriageReviewQueue`, `rescoreArchive`, the review-queue functions, and `recovery-panel.tsx` / `review-queue.tsx` keep working exactly as now. No table dropped, no column removed. The backfill remains the only writer of `email_import_runs`.

## Query to Gmail retrieval

New `src/lib/search/query-plan.server.ts` turns the natural-language line into a structured plan — deterministic parser first, one cheap Gemini call (Lovable AI gateway, same pattern as `classify.server.ts`) only when the deterministic parse is thin:

```text
"fashion designers with 3+ years in Delhi or Mumbai"
  -> { roles: ["fashion designer","apparel designer"],
       skills: ["textile","pattern making","cad"],
       locations: ["delhi","ncr","gurgaon","noida","mumbai"],
       minYears: 3, maxYears: null, salary: null,
       dateFrom: null, labels: [] }
```

New `src/lib/search/gmail-search.server.ts` compiles that plan into 2-4 Gmail `q` strings, run in order until the hit budget fills:

1. attachment-first: `has:attachment (filename:pdf OR filename:doc OR filename:docx) ("fashion designer" OR "apparel designer" OR "pattern making") (Delhi OR Mumbai OR NCR)` plus the existing noise exclusions from `buildQuery`.
2. attachment-first with locations dropped (location often appears only inside the resume).
3. body-only fallback without `has:attachment`, for profiles pasted inline.
4. optional label/date narrowing when the plan carries them.

Budgeted retrieval, not a mailbox scan: hard caps of ~120 message ids listed and ~40 messages fully hydrated (body + primary attachment) per search, `MESSAGE_CONCURRENCY` workers, one Gmail page at a time, early stop once enough ranked hits exist. New `SEARCH_*` constants go in `src/lib/pipeline/config.ts` beside the existing env-overridable ones.

**Limitations to state in the UI.** Gmail `q` is keyword search over headers/body and indexed attachment text — it cannot express "3+ years" or dedupe people, and attachment-text indexing is inconsistent. Gmail is recall-only; precision (years, location, skills, ranking) is ours, computed after hydration from `extractDeterministic` + `classifyItem`. A candidate whose resume never mentions the role keyword in indexed text can be missed; the archive-first leg and the optional backfill cover that.

## Ranking

`src/lib/search/rank.server.ts` scores each hydrated, candidate-classified item 0-100 from the plan: role/title match, skill overlap, location match (with an NCR/Bombay alias table), years vs `minYears`, resume present, recency of `sent_at`, and `classification.confidence` as a multiplier. Non-candidate artifacts (JD, conversation) are excluded from results but surfaced in a small "matching requirement mail" strip, since the classifier already labels them.

Search runs archive-first: query `email_candidates.search_blob`/`skills`/`location` for this user before touching Gmail, so previously imported people appear instantly and their messages are excluded from Gmail hydration. Gmail then only adds what the archive lacks.

## Avoiding whole-mailbox work + dedup

- Only listed ids that survive `messageLooksLikeResumeEmail` get hydrated.
- Ids already in `email_messages` or `email_import_skips` for this user are never re-downloaded (the same whole-page dedup query the importer uses).
- Attachment bytes -> `sha256Bytes` -> reuse `email_resume_versions.extracted_text` by `content_sha256`; on miss parse once and cache.
- `emailCacheKey`/`resumeCacheKey` short-circuit classification.
- Result-set dedup by lowercase email, then `phone_digits`, then normalized name — same precedence as `upsertPersonFromPayload`.

## Data model

Additive only, one migration; every new public table gets GRANTs to `authenticated` (+ `service_role`) and RLS scoped to `user_id`/`agency_id`, matching the existing email tables.

- `email_searches` — id, agency_id, user_id, raw_query, plan jsonb, gmail_queries text[], listed_count, hydrated_count, ai_calls, cache_hits, status, created_at, finished_at.
- `email_search_hits` — id, search_id, agency_id, user_id, gmail_message_id, gmail_thread_id, subject, snippet, from_email/from_name, sent_at, score, confidence, artifact_type, reason, extracted jsonb, `pending_payload` jsonb (the `CandidatePayload` shape, so saving is a pure `upsertPersonFromPayload` call), resume_storage_path, saved_email_candidate_id, saved_at. Unique on (search_id, gmail_message_id).
- No column changes to `email_candidates` / `email_messages` / `email_resume_versions`. Recommend a trigram index on `email_candidates.search_blob` for the archive-first leg.

Search hits are ephemeral by intent: cleanup drops searches older than 30 days. Resume bytes land in the existing private `documents` bucket only for hits the recruiter saves; unsaved hits keep extracted text in `pending_payload` only.

## Evidence and citation

Each result card shows source subject, sender, date, matched terms highlighted, a "View in Gmail" deep link (`https://mail.google.com/mail/u/0/#all/<gmail_message_id>`), and a resume preview through the existing `getArchiveResumeUrl` signed-URL pattern (extended to accept a search-hit id). The score breakdown ("role ok, Mumbai ok, 4 yrs ok, resume attached") renders from stored rank components, so nothing is claimed we can't point at.

## New server functions (`src/lib/search/email-search.functions.ts`)

- `startEmailSearch({ query, dateFrom?, labels? })` — plans, creates `email_searches`, returns searchId + plan for confirmation chips.
- `runSearchBatch({ searchId })` — one bounded slice: list -> prefilter -> hydrate -> classify -> rank -> insert hits; returns progress + new hits so the UI streams results like the importer's batch loop.
- `listSearchHits({ searchId })`, `saveSearchHits({ hitIds })` (archive person via `upsertPersonFromPayload`), `promoteSearchHits({ hitIds })` (straight to `candidates`, reusing `promoteArchivePerson` logic), `dismissSearchHit`, `listRecentSearches`.

All carry `.middleware([requireSupabaseAuth])`, dynamic-import `.server` helpers inside handlers, and validate with zod — same shape as the current file. Page queries stay gated on `enabled: authed`.

## UI/UX on `/email-archive`

- Connection card stays at top, unchanged, plus one line: search needs `gmail.readonly`.
- New hero: large natural-language search input with example chips ("fashion designers 3+ yrs Delhi", "backend engineers Bangalore 8-15 LPA"). Submitting shows the parsed plan as editable chips (role / skills / locations / years / dates) before we spend anything.
- Streaming results list: rank score, name, role, location, years, skills, evidence footer, resume badge, checkbox. Sticky bar: "Add N to candidate database" / "Save to archive" / "Dismiss".
- Live counters in the importer's language: listed / hydrated / cached / AI calls, plus a "budget reached — refine or widen" state.
- Existing sections become secondary tabs: "Archive" (current people list + filters), "Needs your call" (review queue), "Historical backfill" (recovery panel) under a Manage area — nothing lost.
- Recent searches list for re-running a query.

## Rollout

1. Additive migration + new `src/lib/search/*` modules; no existing file behaviour changed.
2. Wire the search UI behind a Search tab that defaults on when the user has no live run; the importer stays reachable.
3. Once search is trusted, make it the default landing view and keep backfill under Manage — still a working fallback where Gmail keyword recall is poor.
4. Nothing is deleted in this plan; a later cleanup can decide the importer's fate.

## Security and privacy

`gmail.readonly` only, no scope widening. Tokens keep living in `google_calendar_connections`, read server-side only through `getValidAccessToken`. Every new row carries `user_id` + `agency_id` with RLS so one recruiter's mailbox results are never visible to another; `supabaseAdmin` is used only inside handlers after `requireSupabaseAuth`. Attachment bytes never reach the browser except via short-lived signed URLs. Only truncated cleaned body/doc text (existing `AI_MAX_BODY_CHARS` / `AI_MAX_DOC_CHARS` caps) reaches the model. Unsaved search hits expire.

## Cost and performance

Per search: 1 optional planning AI call, 2-4 Gmail list calls, up to 40 message fetches, up to 40 attachment downloads, and AI classification only for the ambiguous middle band — cache hits from prior backfill/searches typically reduce that to a handful of calls. First results in a few seconds, a full search in roughly 10-30s, versus hours and thousands of AI calls for a mailbox backfill.

## Testing and edge cases

- Query planning: role-only, skills-only, salary band, "last 6 months", non-English, gibberish, empty.
- Zero Gmail hits -> archive-only results with a "widen the query" hint; zero everything -> guidance, not a spinner.
- Budget exhaustion mid-search; user navigates away mid-batch (resumable by `searchId`).
- Revoked token / missing `gmail.readonly` mid-search -> the existing reconnect prompt, not a 500.
- Same person across three messages collapses to one result; person already in `email_candidates`; person already promoted to `candidates` (show "already in database").
- JD/mandate mail must never rank as a candidate (existing `job_description` guard).
- Oversized (>8 MB) or legacy `.doc` attachments degrade to body-only extraction.
- Saving 20 hits at once, including one whose email already exists in `candidates` (must link, not fail).
- Concurrent backfill run + search on the same account must not double-insert (`onConflict user_id,gmail_message_id`).