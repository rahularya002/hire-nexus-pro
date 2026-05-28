# Apify candidate sourcing integration

Sourcing flow becomes: **internal DB → (if not enough matches) Apify → store results back into DB → AI rank → show in Scout**.

## 1. Setup

- Create Apify account, copy Personal API token.
- Add runtime secret `APIFY_API_TOKEN` via Lovable Cloud (server-only).
- Pick one combo actor to start (e.g. `harvestapi/linkedin-profile-scraper` or similar multi-source actor) + `apify/github-scraper` for tech roles. Store actor IDs in a server-side constant map keyed by source chip.
- Limited chips enabled in v1: **LinkedIn** + **GitHub**. Others stay visible but disabled with a "coming soon" tooltip.

## 2. Database changes (single migration)

New tables, all with proper GRANTs + RLS (staff-only read/write, no client/anon access):

- **`sourced_candidates`** — cache of every profile Apify ever returned. Fields: `id`, `source` (linkedin/github/...), `source_profile_id` (unique per source), `name`, `headline`, `current_company`, `location`, `experience_years`, `skills text[]`, `email`, `phone`, `profile_url`, `avatar_url`, `raw jsonb` (full actor payload), `last_seen_at`, `created_at`. Unique index on `(source, source_profile_id)` for upsert.
- **`position_sourcing_runs`** — one row per Match click. Fields: `id`, `position_id`, `triggered_by`, `sources text[]`, `apify_run_ids jsonb`, `status` (pending/running/succeeded/failed), `result_count`, `cost_credits`, `error`, `created_at`, `finished_at`.
- **`position_sourced_matches`** — join table linking a run + sourced_candidate + position, with `match_score int`, `reasoning text`, `rejected boolean default false`, `rejected_reason text`. This is what powers the cache: next search for the same position skips anyone already in here unless rejected.

Existing `candidates` table stays for shortlisted/active pipeline candidates; on shortlist we copy a `sourced_candidates` row into `candidates`.

## 3. Server functions (`src/lib/apify.functions.ts` + `apify.server.ts`)

All `createServerFn` with `requireSupabaseAuth`, staff role-gated.

- **`searchInternalCandidates({ positionId, jobTitle, skills, location, limit })`** — queries `sourced_candidates` + `candidates` filtered by skills overlap / title fuzzy match, excluding anyone already rejected for this position. Returns ranked list.
- **`runApifyScout({ positionId, sources, jobTitle, skills, location, maxResults })`**:
  1. Insert `position_sourcing_runs` row (status `running`).
  2. Per source, call Apify **run-sync-get-dataset-items** endpoint with mapped input schema.
  3. Normalise each actor's output → common shape.
  4. Upsert into `sourced_candidates` on `(source, source_profile_id)`.
  5. Insert `position_sourced_matches` rows for this run.
  6. Update run row (`succeeded`, counts).
- **`rankSourcedCandidates({ runId, jdText })`** — batched Gemini 2.5 Flash call (20 candidates per request), writes `match_score` + `reasoning` back to `position_sourced_matches`.
- **`rejectSourcedMatch({ matchId, reason })`** — so rejected profiles get filtered out next search.

## 4. Frontend wiring (`src/routes/scout.tsx` + `ScoutResults`)

- Keep existing JD textarea + CV attach + source chips + Match button.
- On **Match** click:
  1. Call `searchInternalCandidates`. If ≥ N results (e.g. 10), show those immediately, label "From your database".
  2. Otherwise (or via a "Source more" button), call `runApifyScout` with selected chips → spinner with run status → on success call `rankSourcedCandidates` → render results, label "Newly sourced".
- Each result card shows source badge, contact info (email/phone where available), match score, reasoning, and a **Reject** button (writes to `position_sourced_matches.rejected`) + **Shortlist** button (creates `candidates` + `applications` row at `sourcing` stage tied to the position).

## 5. Cost & safety guardrails

- `maxResults` capped at 25 per source per run (configurable later). Stops accidental $$$ Apify bills.
- Run-sync timeout: 5 min. If actor takes longer, fall back to async pattern in v2.
- AI ranking batched 20 per call → ~$0.005 per 200 candidates.
- Server-side rate limit: max 5 Apify runs per position per hour.

## 6. Honest limitations

- **GitHub**: only email when user made it public on their profile. No phone. We'll surface `null` clearly in the UI, never fake it.
- **LinkedIn actors** are paid Apify actors (most cost ~$1–5 per 1000 profiles depending on actor). We display estimated cost before triggering a fresh run.
- Apify combo actors vary in quality — final actor choice locked in once you confirm which one you want; the integration shape doesn't change.

## Out of scope (v2)

- Async run + webhook callback for big searches (>25 results / >5 min).
- Auto-outreach (email/LinkedIn DM templates).
- Naukri / Indeed / Hirist scrapers.
- Candidate deduplication across sources (same person on LinkedIn + GitHub).

Confirm the actor choice (any specific Apify actor you've already shortlisted?) and I'll start with the migration.
