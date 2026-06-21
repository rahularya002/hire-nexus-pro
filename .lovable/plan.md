## Goal

Replace the direct "Scout" entry in the agency panel with a hub page **/sourcing** that branches into two flows:
1. **Scouting** — existing AI scout (no behaviour change).
2. **Posting** — compose a job post from an existing position or from scratch, and publish it to LinkedIn, Naukri, Indeed, and the internal job board, with per-channel status tracking and applicant capture.

---

## Navigation changes

`src/components/app-shell.tsx`
- In `agencyNav`, replace the standalone scout entry with a new section **Sourcing** containing one item: `{ to: "/sourcing", label: "Sourcing", icon: Sparkles }`.
- Bottom-left "AI Talent Scout" CTA card → point to `/sourcing` and relabel the button "Open Sourcing".
- Recruiter nav: add the same `/sourcing` item under Talent (gated by `candidates.view`).
- Existing internal links to `/scout` (dashboard, me, positions detail, ongoing) stay — `/scout` keeps working.

## New routes

```
src/routes/
  sourcing.tsx              # hub layout, renders <Outlet/>; head() meta
  sourcing.index.tsx        # two big cards: "AI Scouting" → /scout, "Job Posting" → /posting
  posting.tsx               # layout, <Outlet/>
  posting.index.tsx         # list of job posts (status per channel, filters)
  posting.new.tsx           # composer (pick position OR free-form)
  posting.$postId.tsx       # post detail: per-channel status, edit, republish, view applicants
  jobs.$slug.tsx            # PUBLIC internal job board landing page (apply form)
  api/public/jobs/apply.ts  # POST application from public page (rate-limited, captcha-lite honeypot)
  api/public/webhooks/indeed.ts   # optional inbound applicant webhook
```

`/scout` and `/client/scout` are unchanged.

## Data model (one migration)

New tables (all with GRANTs, RLS, agency-scoped policies via `is_agency_member`):

- **job_posts** — `id, agency_id, position_id (nullable), title, slug (unique), description_md, location, employment_type, comp_min, comp_max, currency, tags text[], status (draft|published|closed), created_by, created_at, updated_at, public bool`.
- **job_post_channels** — `id, job_post_id, channel (enum: linkedin|naukri|indeed|internal), status (pending|publishing|published|failed|manual), external_post_id, external_url, error, last_synced_at, published_at`.
- **job_applications** — `id, job_post_id, channel, applicant_name, email, phone, resume_doc_id (fk documents), cover_note, source_url, raw jsonb, status (new|reviewed|converted|rejected), candidate_id (nullable, set when converted), created_at`. Trigger: notify agency members on insert.

Existing `applications` stays for pipeline; conversion = create `candidates` + `applications` rows from a `job_applications` row.

Migration also: enum types, `set_updated_at` triggers, `set_agency_id_default` trigger on all three, GRANTs to authenticated + service_role, narrow `TO anon` SELECT policy on `job_posts WHERE public AND status='published'` for the public board.

## Server functions (`src/lib/posting.functions.ts`)

All `requireSupabaseAuth`, agency-scoped:
- `listJobPosts`, `getJobPost`, `createJobPost`, `updateJobPost`, `deleteJobPost`
- `publishJobPostChannels({ postId, channels[] })` — dispatches per channel:
  - **internal**: marks `published`, sets public slug.
  - **linkedin**: calls LinkedIn connector gateway (`POST v2/ugcPosts`), stores `external_post_id` + `external_url`. Requires a linked LinkedIn connection with `w_member_social`; if missing, returns a typed `needs_connector` result and the UI prompts to connect.
  - **naukri**, **indeed**: no public posting API — sets `status='manual'` and returns a prefilled URL + clipboard payload; UI opens the platform's "new post" page in a tab. (Real API integration left as a future swap-in behind the same dispatcher.)
- `listJobApplications({ postId })`, `convertApplicationToCandidate({ applicationId, positionId? })` — creates `candidates` + `applications` rows, links `candidate_id`.

Public server route `api/public/jobs/apply` — Zod-validated, writes via `supabaseAdmin` (loaded inside handler), honeypot field, IP-rate-limited via a small `notification_dedup`-style key.

## Composer UX (`posting.new.tsx`)

- Top toggle: **From position** | **Free-form**.
  - From position: select from open `positions` → prefills title, description (JD), location, comp, tags.
  - Free-form: blank fields.
- Channel checkboxes: LinkedIn, Naukri, Indeed, Internal (default all on).
- Per-channel preview pane (LinkedIn: 1300-char ugcPost preview; Naukri/Indeed: plain text; Internal: rendered markdown card).
- Save as draft / Publish now.

## Post detail (`posting.$postId.tsx`)

- Header: title, position link, status pill.
- Channels grid: per channel status + external URL + "Republish" / "Open compose tab" / "Mark posted" (for manual channels).
- Applicants tab: table of `job_applications`, "Convert to candidate" action (opens position picker → calls `convertApplicationToCandidate`), "Reject", "Download resume".

## Public job board (`jobs.$slug.tsx`)

- SSR public route, uses publishable-key Supabase client + the anon SELECT policy.
- Renders title, description (md), location, comp, apply form (name, email, phone, resume upload to `documents` bucket via signed upload from the public API).
- `head()` sets title/description/og from the post.

## Out of scope (v1)

- Real Naukri/Indeed publishing APIs (kept as `manual` channel with deep link + clipboard).
- LinkedIn Company Page posting (only member posting via connected account).
- Auto-matching scout results to job posts.
- Scheduled posting / cross-channel analytics dashboards.

## Files touched

- **Add**: migration; `src/lib/posting.functions.ts`; routes `sourcing.tsx`, `sourcing.index.tsx`, `posting.tsx`, `posting.index.tsx`, `posting.new.tsx`, `posting.$postId.tsx`, `jobs.$slug.tsx`, `api/public/jobs/apply.ts`; small components `src/components/posting/*` (ChannelBadge, ComposerForm, ApplicantsTable).
- **Edit**: `src/components/app-shell.tsx` (nav + CTA).
- **Connector**: prompt to link LinkedIn connector on first LinkedIn publish.
