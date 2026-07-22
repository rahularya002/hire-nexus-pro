## Fix RLS failures on sourcing + activities, and scout UI crash

The user is hitting two Project monitoring RLS findings plus a related UI crash:

1. **Sourcing run insert blocked by RLS** — `position_sourcing_runs` INSERT policy is `WITH CHECK (is_agency_member(agency_id))`, but `runApify` inserts without `agency_id`. Insert fails → server fn throws → client sees "can't access property 'errors', n is undefined" because `scout.tsx` reads `run.errors` on an undefined result. (finding `error_log_finding_c42190238d84be811a861dadbd0cc5c0`)
2. **Activities inserts blocked by RLS** — `activities.agency_id` is NOT NULL and RLS requires the caller's agency. `createActivity` and both `logActivity` helpers (candidates, interviews) insert without it, so audit rows silently drop and `createActivity` throws to the caller. (finding `error_log_finding_68d74bbff2a7864cf89f81b344e61f80`)

Both stem from the same missing step: server functions never resolve the caller's `agency_id` before insert.

### Plan

**1. Add a shared helper to resolve the caller's agency**
- New helper `getUserAgencyId(supabase, userId)` in a small server-safe module (e.g. `src/lib/auth/agency.ts`), reading `agency_members.agency_id` for the caller. Cache-free, one-shot query.

**2. `src/lib/apify.functions.ts` — stamp `agency_id` on `position_sourcing_runs`**
- Before the insert (line ~470), resolve the caller's agency and include `agency_id` in the payload.
- If the caller has no agency membership, return early with a clear error instead of throwing at the DB.

**3. `src/lib/activities.functions.ts` — stamp `agency_id` on inserts**
- In `createActivity`, resolve caller agency and include it in the insert (throw a clean error if missing).
- Export the internal helper or use the shared one from step 1.

**4. `src/lib/candidates.functions.ts` and `src/lib/interviews.functions.ts` — same fix in `logActivity`**
- Update the local `logActivity(supabase, userId, ...)` helpers to look up the caller's agency once (or accept it from the call site where the row already has an agency) and set `agency_id` on the insert. Keep the "swallow errors" behavior for these background writes.

**5. `src/routes/scout.tsx` — defensive read**
- Change `if (run.errors.length && !run.resultCount)` to guard against an undefined result (`run?.errors?.length`), so an upstream failure surfaces as a real error message instead of the confusing "n is undefined" crash. Root cause is fixed in #2, but the guard prevents future regressions.

### Out of scope
- The other three findings (reschedule Google Meet sync, salary filter clamp, bulk import password validation) — not part of this request.

### Verification
- Trigger a "Source more from LinkedIn / GitHub" run on a position; confirm no RLS error, run row is created with `agency_id`, and results (or a proper error message) render.
- Create a candidate / schedule an interview; confirm activity rows appear in the Activity feed without RLS errors in Postgres logs.
