## Plan

### 1. Lock icon on disabled chips (Talent Scout)
In `src/routes/scout.tsx`, the `SOURCES` array marks Naukri, iimjobs, Hirist, Instahyre, Cutshort, Wellfound, Referrals as `enabled: false`. Currently they render with a `Briefcase`/`Globe` icon and the text `soon`.

- Swap the icon for a `Lock` icon (from lucide-react) when `!s.enabled`, so the chip clearly reads as "locked / no integration yet".
- Keep the existing "soon" label + disabled styling + tooltip hint.
- LinkedIn, GitHub, Internal stay as-is (they have actors / are wired).

### 2. Admin → Master Settings section
Add an admin-only settings hub for managing integrations & actors. Two parts:

**a) New route `src/routes/admin.settings.tsx`** (gated to `admin` role via `useAuth` + `has_role` check, redirect non-admins to `/`).

Layout: tabbed/sectioned page with these cards (v1, mostly read-only + light editing):

- **Integrations**
  - Apify — status pill (Connected if `APIFY_API_TOKEN` secret present, else Not configured), short description, "Manage secret" hint pointing to Lovable Cloud secrets.
  - Lovable AI — status pill (always connected via `LOVABLE_API_KEY`), model used for ranking.
  - Placeholder rows for future: Email finder, LinkedIn Sales Nav, etc. (greyed, "Coming soon").

- **Sourcing actors** (the master list that drives the Scout chips)
  - Table of sources: name, channel (linkedin/github/…), actor slug, status (Enabled / Locked / Coming soon), est. cost per 1k.
  - For v1, this is rendered from a config constant `src/lib/scout-sources.ts` (single source of truth). The Scout page imports the same constant so flipping `enabled` or changing actor slug in one place updates both the admin table and the chips.
  - Admin can toggle Enable/Disable per source via a switch (persisted to a new tiny table `scout_source_settings(source_id text pk, enabled boolean, actor_slug text nullable, updated_at, updated_by)` — only `admin`/`lead_recruiter` can write; everyone authenticated can read so Scout reflects current state).
  - Toggle is only meaningful for sources that have an actor wired; locked ones show the lock and are not toggleable.

- **AI ranking**
  - Read-only summary: model = `google/gemini-2.5-flash`, max candidates ranked per run, rough cost note.

**b) Sidebar / nav**
- Add an "Admin settings" link in the app sidebar (or under existing admin section) visible only when `has_role(admin)`.

### 3. Wire Scout chips to the new settings
- `src/routes/scout.tsx` reads the source list from `src/lib/scout-sources.ts` + a lightweight `useQuery` against `scout_source_settings` to apply admin overrides (enabled flag, actor slug).
- Locked sources (no actor) always render with the Lock icon regardless of DB toggle.

### Technical bits
- New file: `src/lib/scout-sources.ts` — exports the canonical source registry (id, label, icon, channel, default actor slug, hasActor).
- New file: `src/routes/admin.settings.tsx`.
- New server fns in `src/lib/admin-settings.functions.ts`: `listSourceSettings`, `upsertSourceSetting` (admin/lead only).
- Migration: create `public.scout_source_settings` with GRANTs + RLS (read = authenticated; write = admin or lead_recruiter).
- Scout page: refactor `SOURCES` → `useSources()` hook merging registry + DB overrides; render `Lock` icon when `!hasActor`.

### Out of scope (v1)
- No editing of secret values from the UI (still done via Lovable Cloud secrets panel — we just surface status).
- No per-actor input-schema editor; actor slug change is a single text field.
- No usage/cost dashboard yet (just static estimates).

Sound good? Once you approve I'll switch to build mode and ship it.