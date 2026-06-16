## Goal

Make the Apify scout return only people who are realistically hire-able:
1. Prefer / prioritize "Open To Work" (OTW) profiles
2. Hard-exclude profiles that are clearly hiring/recruiting (talent acquisition, "we're hiring", founders posting roles, recruiters)
3. For non-OTW profiles that still pass the hiring filter, always surface current organization, experience, headline, location — never blank

This is a normalization + filter layer on top of the existing scout pipeline. No DB schema changes required (we reuse `sourced_candidates.raw`), but we add two cached flags into the row so the UI can badge OTW vs passive.

## What to build

### 1. Detect signals in `src/lib/apify.server.ts`

Add two pure helpers used during normalization:

- `detectOpenToWork(o)` — true when any of the following is present in the LinkedIn raw object:
  - `openToWork === true`, `isOpenToWork === true`, `openToWorkStatus` truthy
  - badge / frame fields: `profilePictureFrame`, `openToWorkPhotoFrame`, `hasOpenToWorkPhotoFrame`
  - headline / about contains `#opentowork`, `open to work`, `open for opportunities`, `looking for new opportunities`, `actively seeking`, `available for hire`, `seeking new role`
  - `jobSeekerStatus` / `jobSearchStatus` indicating active

- `detectHiringProfile(o)` — true when:
  - headline / current title matches `/recruiter|talent acquisition|talent partner|technical recruiter|sourcer|head of (talent|people)|hr (manager|business partner)|people ops/i`
  - headline / about contains `#hiring`, `we're hiring`, `we are hiring`, `now hiring`, `dm me your cv`, `apply here`, `join our team`, `hiring [a-z ]+ engineers?`
  - `openToHiring === true`, `hiringStatus` truthy, OTW-style "Hiring" frame fields

### 2. Update `normalizeLinkedIn`

- Compute `openToWork` and `isHiring` flags.
- Return `null` (filter out) when `isHiring === true` AND `openToWork === false` — these are recruiters/founders posting roles, not candidates. (If a person is both OTW and posting jobs, keep them — rare but legitimate.)
- Even when `openToWork === false`, keep filling `headline`, `current_company`, `location`, `experience_years` from the raw object (current logic already does this — verify, and add fallbacks: `o.jobTitle`, `o.position`, `o.currentPosition?.title`, `(o.experience?.[0])?.companyName`, `(o.experience?.[0])?.title`).
- Attach the flags onto the normalized profile so they round-trip into storage via the `raw` blob, plus expose them on `NormalizedProfile` itself.

### 3. Persist the flags

Add two columns to `sourced_candidates`:
- `open_to_work boolean default false`
- `is_hiring boolean default false`

(Migration with backfill = false; new inserts populate the flags. Existing rows can stay false — they'll refresh on next scout.)

Update the upsert in `runApifyScout` to write both flags.

### 4. Ranking / surfacing

In `runApifyScout`, after normalizing:
- Drop any profile where `isHiring && !openToWork` (defense in depth — already filtered at normalize but covers shapes we missed).
- Sort `allProfiles` so OTW comes first, then the rest. Limit still respected.
- Pass the OTW flag into the AI rank prompt as an extra signal ("openToWork: true/false") so it can weight it.

### 5. UI surfacing (small)

In `SourcedMatchView` add `openToWork: boolean`. In `src/routes/client.positions.$positionId.tsx` (and any other consumer of `searchSourcedCandidates`), show a small "Open to work" badge next to the name when true. Ensure the meta row (current org / experience / location / match %) renders "—" instead of hiding when a field is null — keep the row always visible.

## Technical notes

- LinkedIn Apify actors are inconsistent — that's why both raw-field checks and text-pattern checks are needed.
- Filtering happens at normalize time (before upsert) so we don't pollute `sourced_candidates` with recruiters going forward.
- A subsequent "refresh" of an existing recruiter row won't auto-delete it; if needed we can add a maintenance fn later. Out of scope for this change.
- No change to GitHub path — GitHub doesn't have OTW/hiring semantics in the same way.

## Files touched

- `supabase/migrations/<new>.sql` — add `open_to_work`, `is_hiring` columns
- `src/lib/apify.server.ts` — detectors, normalize update, type update
- `src/lib/apify.functions.ts` — upsert new columns, sort OTW-first, expose flag in `SourcedMatchView`, pass into rank
- `src/routes/client.positions.$positionId.tsx` — "Open to work" badge + always-visible meta row
