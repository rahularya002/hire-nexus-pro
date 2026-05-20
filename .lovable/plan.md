## What changes

### 1. Hide inactive clients from recruiters
- In `src/routes/admin.clients.tsx` and anywhere else the global `clients` list is shown to non-admins (dashboard "Inactive clients" panel, Clients sidebar), gate via `useCan("clients.manage")` / role check.
- Recruiters (lead/senior/recruiter) get a filtered list with `isClientInactive(c) === false`.
- Admin keeps the full Active / Inactive / All toggle.

### 2. Inactive-client detail metrics (admin only)
Replace the current single "Last activity Xd" line on inactive rows in `admin.clients.tsx` with a richer block. Extend the `Client` type in `src/lib/mock-data.ts` and seed values:
- `lastMandateDays` — flagged when > 60
- `lastClosureDays` — flagged when > 90
- `spoc: { name, email, phone }` — point of contact
- `positionsClosedYTD: number`
- `revenueYTDInr: number` (formatted as ₹ lakhs/cr)

New inactivity rule: `isClientInactive` becomes `lastMandateDays > 60 || lastClosureDays > 90` (the `INACTIVITY_THRESHOLD_DAYS = 7` heuristic goes away). Update the helper text on the page.

Render the metrics inline on each inactive row and in an expandable details panel; active rows show a compact "X positions YTD · ₹Y revenue" summary.

### 3. Today's interviews — group by company
- In `src/routes/interviews.tsx`, group `todaysInterviews` by `client` and render one collapsible card per company with candidates beneath it (time, candidate, position, round, mode, Join). Header shows `<Client> · N interviews`.
- Same grouping applied to `client.interviews.tsx`? No — that view is already client-scoped, leave it.
- The dashboard "Today's interviews" tile stays flat (compact), no change.

### 4. Recruiter activity visibility
- New page `src/routes/activity.tsx` (Recruiter Activity feed): per-recruiter stream of actions (calls, shares, shortlists, interviews scheduled, offers, closures) sourced from `src/lib/ops/store.ts` mock events.
- Manager/admin view: dropdown to pick any recruiter or "All recruiters", plus a leaderboard summary (shares, interviews, offers, closures today/this week).
- Recruiter view: locked to their own feed + their own summary tile so they can self-track.
- Sidebar entry "Activity" gated by `team.view` (existing perm); content gated by role at component level.

### 5. AI Scout — "All channels"
- In `src/routes/scout.tsx`, add an "All channels" chip at the top of the source list that toggles every source on/off (selected by default on first load so new scouts run against everything).
- Update default `selected` state to all source ids.
- Visual: when all are on, the All-channels chip shows a filled state; toggling any individual chip off deselects it.

## Out of scope
- Wiring real (non-mock) activity events; the activity feed reads from existing mock store.
- Changing the recruiter→client RLS at the DB level (UI-level filter only for now; flag for follow-up if needed).
- Editing the client portal interview page.

## Technical notes
- Permission gating uses the existing `useCan` hook from `src/lib/ops/access.ts` plus role check via `useAuth().profile`. Admin role bypasses all checks.
- All data lives in mock files (`mock-data.ts`, `ops/store.ts`); no migrations needed.
- Money formatting helper added to `src/lib/utils.ts` (`formatInrShort`).
