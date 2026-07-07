## Problem

When a client creates a new requirement, no one on the agency side gets notified. `createPosition` in `src/lib/positions.functions.ts` just inserts the row and returns — there is no `notifications` insert, and there is no DB trigger on `positions` either (the only agency-side notification triggers are `notify_agency_on_new_job_application` and `notify_agency_on_joining`).

Related gap: `assignPositionRecruiter` already notifies the newly assigned recruiter, but the bulk `assignClientRecruiter` (used on the client detail page) does not — only a single-recruiter fallback lives there.

## Fix

### 1. Notify agency on new requirement (`createPosition`)

After the insert succeeds, if `recruitment_model !== 'self'` (self-serve requirements don't need agency attention):

- Read `agency_id`, `title`, and client `name` from the newly created row.
- Fetch all `agency_members.user_id` for that `agency_id` via `supabaseAdmin`.
- Bulk insert one row per member into `notifications` with:
  - `kind: 'system'`
  - `title: 'New requirement: <title>'`
  - `body: '<Client name> posted a new requirement'` (+ `" — assigned to you"` for the assigned recruiter if one was set at creation)
  - `link: '/positions/<id>'`
- If `assigned_recruiter_id` was set on create, also send that recruiter the existing "Assigned: <title>" notification (same shape as `assignPositionRecruiter`), so the assignment path stays consistent whether the recruiter is picked at creation or later.

Wrapped in try/catch with `console.error` so a notification failure never blocks requirement creation.

### 2. Fix `assignClientRecruiter` bulk assignment notification

Today it only inserts a notification when there is at least one row updated, but it sends a single generic notification. Keep that, and additionally short-circuit duplicates: skip if the recruiter is already assigned to every updated row (i.e. no change).

### Out of scope

- No new DB trigger — keeping notification logic in the server functions matches the existing pattern (`assignPositionRecruiter`, `assignClientRecruiter`) and avoids a migration.
- No changes to the notification bell UI; it already reads from the same `notifications` table.
- No email/push — in-app only, same as today.

### Files

- `src/lib/positions.functions.ts` — extend `createPosition` handler; small tightening in `assignClientRecruiter`.
