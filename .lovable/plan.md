# Refocus the agency Team page on people activity

Right now `/team` (Recruiter roster) is a productivity scoreboard — shares today, closures MTD, conversion %. You want the opposite: a view that answers "who's on my team, when did they log in, which clients are they handling, and what have they been doing?"

## What changes on the Team page

Replace the current roster table and summary tiles with three connected views:

### 1. Header tiles (replace existing 5)
- Team size (total members)
- Online now (with green pulse)
- Logged in today
- Active in last 24h (anyone with ≥1 activity)

### 2. Team members list (replaces the productivity table)
One row per teammate showing only people-focused info:
- Avatar, name, role, joined date
- Status dot + "Last login" (e.g. "Today 09:42", "2 days ago")
- Clients they're working with — small colored chips of client names (from positions where they're the assigned recruiter); "+3 more" overflow
- Activity in last 7 days (count, e.g. "47 actions")
- Click row → expands an inline activity drawer (see #3)

### 3. Per-person activity drawer (inline expand, or right-side sheet)
When a teammate row is clicked:
- Login timeline: last 10 sign-in timestamps
- Clients & positions they own (full list, grouped by client)
- Activity feed: their last 50 actions from the `activities` table (shares, calls, interviews scheduled, offers, notes…) — same card style as the global Activity page, filtered to `actor_id = member.id`

### 4. Keep
- "Add teammate" dialog (unchanged)
- "Roles & Permissions" tab (unchanged)

### Remove
- Shares today / Closures MTD / Conversion % columns and tiles — these belong on a performance/analytics page, not here.

## Technical notes

- Extend `getTeamMembers` in `src/lib/team.functions.ts` to also return, per member:
  - `lastLoginAt` (from `auth.users.last_sign_in_at` via `supabaseAdmin.auth.admin.listUsers`)
  - `clients`: list of `{ id, name, color }` derived from `positions.assigned_recruiter_id` → `clients`
  - `activityCount7d`: `count` from `activities` where `actor_id = member.id` and `occurred_at >= now() - 7d`
- New server fn `getTeamMemberActivity({ userId })` returning recent activities + login history + owned positions for the drawer (reuses `listActivities` filter by `actorId`, already supported).
- Rewrite `src/routes/team.tsx` roster tab: new tiles, new table, expandable row using existing `activities` data and `KIND_META` styling pattern from `src/routes/activity.tsx` for consistency.
- No schema changes; no new tables.

## Files touched
- `src/lib/team.functions.ts` — extend `getTeamMembers`, add `getTeamMemberActivity`
- `src/routes/team.tsx` — rewrite roster tab UI; keep Add teammate + Roles tabs intact
