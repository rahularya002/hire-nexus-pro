
## Goal

Give every recruiter on the roster a personal "My Desk" dashboard where they can flip their own status (Available / Active / On Break / Offline), see only what their role permits, and act on their own work — mirroring the agency portal but scoped to them.

## Where roles & permissions live today

`src/routes/team.tsx` already defines:
- Permission keys: `candidates.view/edit/delete`, `positions.view/create/assign`, `clients.view/manage`, `pipeline.share/move`, `team.view/invite`, `roles.manage`, `billing.manage`
- 4 system roles: Admin · Lead Recruiter · Senior Recruiter · Recruiter
- Recruiter statuses (`src/lib/ops/store.ts`): `Available | Active | Break | Offline`

These are mock/local state. We'll lift them into a shared store so the dashboard, sidebar, and team page all read from the same source.

## Plan

### 1. Lift roles, permissions & current user into a shared store
New `src/lib/ops/access.ts`:
- Move `ALL_PERMISSIONS`, `PermKey`, `Role`, `DEFAULT_ROLES` out of `team.tsx`.
- Add `currentRecruiterId` (defaults to first recruiter; switchable from a dev-only "Impersonate" picker in the topbar so you can demo each role).
- Helpers: `useCurrentRecruiter()`, `useMyPermissions()`, `can(perm)`.
- `setMyStatus(status)` mutates the recruiter in `ops/store` and notifies subscribers (simple `useSyncExternalStore` pattern, no backend yet — same approach as the rest of the app).

### 2. New route: `/me` (My Desk)
File: `src/routes/me.tsx`, rendered inside the existing `AppShell`.

Top bar of the page:
- Avatar + name + role badge
- **Status pill with dropdown** → Available · Active · On Break · Offline (writes via `setMyStatus`, updates the green/amber dot everywhere instantly)
- "Logged in since…" timer

KPI strip (scoped to the current recruiter):
- Open positions assigned to me
- Candidates in my pipeline
- Shares today / Closures MTD / Conversion %
- SLA chip (avg response time vs target)

### 3. Permission-gated widgets on the dashboard
Each card only renders if `can(perm)` is true:

| Widget | Required permission |
|---|---|
| My Positions (table, click → `/positions/$id`) | `positions.view` |
| My Pipeline (mini kanban of my candidates) | `candidates.view` |
| Today's Interviews (from `interviews` data, filtered to me) | `candidates.view` |
| Tasks / follow-ups due today | `candidates.view` |
| Quick "Share to client" action | `pipeline.share` |
| "Create position" CTA | `positions.create` |
| "Assign recruiters" shortcut | `positions.assign` |
| Team presence strip (who's Available/Break right now) | `team.view` |
| Roles & billing shortcuts | `roles.manage` / `billing.manage` |

Sidebar (`app-shell.tsx`) is also filtered by the same `can()` so a Recruiter doesn't see Team / Roles entries at all. "My Desk" becomes the new default landing route after sign-in.

### 4. Additional sections worth adding (mirroring the main portal)
Suggested, in priority order:
1. **My Activity feed** — reverse-chronological events on my own work (profile shared, interview scheduled, client feedback received). Reuses the `activityEvents` pattern from the client portal.
2. **My Notifications bell** — unread mentions, slot proposals, client replies.
3. **Goals & targets** — monthly closures target with a progress bar; conversion vs team average.
4. **Leaderboard / team presence** — small card showing who else is online and top performers this week (read-only for non-leads).
5. **Quick actions row** — Add candidate · Upload JD (if `positions.create`) · Log a call · Schedule interview.
6. **My calendar** — today + next 7 days of interviews and follow-ups.
7. **Saved searches & AI Scout shortcuts** — only if `candidates.view`.
8. **Recent clients I'm working with** — quick switcher (only if `clients.view`).
9. **Documents shared with me** — JDs, offer letters relevant to my positions.
10. **Status history & timesheet** — auto-log of Available/Break transitions for the day; useful for ops review.

I'd build 1–6 in the first pass and leave 7–10 as a follow-up.

### 5. Status visible everywhere
Wherever a recruiter avatar shows up today (`/team`, position detail "assigned to", client portal Account Team), read the live status from `ops/store` so the dot updates the moment the user changes it on their own dashboard.

## Files touched

- New: `src/lib/ops/access.ts`, `src/routes/me.tsx`, `src/components/me/*` (StatusPicker, KpiStrip, MyPositions, MyPipeline, TodayInterviews, ActivityFeed, TeamPresence)
- Edit: `src/routes/team.tsx` (import perms from access.ts), `src/components/app-shell.tsx` (permission-gated nav + impersonation picker + default route to `/me`), `src/lib/ops/store.ts` (subscribe/notify for status changes)

## Out of scope (for this pass)
- Real auth — we'll keep the impersonation picker until Lovable Cloud auth is wired.
- Persistence across reloads (mock data resets, same as today).
- Per-recruiter analytics beyond what's already in `dashboard.tsx`.

After approval I'll implement steps 1–3 + widgets 1–6 in one pass and pause for review before the rest.
