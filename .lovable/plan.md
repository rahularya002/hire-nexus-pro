## Goal

Today every agency admin sees every other agency's data. We're fixing that. After this pass:
- Each row of tenant data belongs to exactly one agency.
- Agency members only see/modify their own agency's data.
- Super admin still sees everything.
- Clients still see only the data tied to their own `clients.id` (their company).

## Scope of tables getting `agency_id`

Tenant-owned (need `agency_id NOT NULL`):
`clients`, `positions`, `candidates`, `applications`, `interviews`, `placements`, `invoices`, `invoice_line_items`, `client_billing_terms`, `documents`, `message_threads`, `tasks`, `activities`, `sourced_candidates`, `position_sourcing_runs`, `position_sourced_matches`, `interview_round_templates`, `scout_source_settings`.

Already scoped or out of scope:
- `agencies`, `agency_members`, `support_tickets` (already have `agency_id`).
- `profiles`, `user_roles`, `notifications` (user-scoped, not agency-scoped).
- `messages` (scoped via parent `message_threads.agency_id`).
- `role_permissions`, `notification_dedup` (global).

Current data: 1 agency (`Default Agency`), 2 members. All existing rows backfill to that agency — no ambiguity.

## Migration (single file)

1. Add `agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE` to every table above (nullable first).
2. Backfill every existing row → `Default Agency`.
3. Set `NOT NULL` + index `(agency_id)` on each.
4. Helper functions (SECURITY DEFINER):
   - `current_user_agency_id() returns uuid` — returns the agency the caller belongs to via `agency_members`.
   - `is_agency_member(_agency_id uuid) returns boolean`.
5. Trigger `set_agency_id_default` on INSERT for every tenant table: if `NEW.agency_id IS NULL`, set it from `current_user_agency_id()` (skips when caller is super_admin and explicitly provides one).
6. Rewrite RLS for every tenant table:
   - SELECT/INSERT/UPDATE/DELETE allowed when `is_agency_member(agency_id)` OR `has_role(auth.uid(),'super_admin')`.
   - Existing client-portal SELECT policies (e.g. "client sees own positions") are preserved alongside.
7. `messages` policies updated to derive agency via `message_threads`.

## Code changes

Minimal — the trigger auto-stamps `agency_id`, so existing `createServerFn` handlers keep working. We only need to:
- Confirm no handler manually sets `agency_id` to a wrong value.
- `superadmin.functions.ts` agency-create flow already sets membership — no change.
- Recruiter invite / agency onboarding: ensure new users get an `agency_members` row (audit `team.functions.ts` and `superadmin.functions.ts`).

No UI changes in this pass.

## Risk & rollback

- Single agency today → backfill is safe.
- If a user has no `agency_members` row, inserts fail (trigger returns null). We'll surface a clear error from the trigger: `RAISE EXCEPTION 'User has no agency membership'`.
- Super admin without membership: trigger checks `has_role super_admin` first and allows `agency_id` from payload.

## Out of scope this pass

- `agency_id` on `notifications` (user-scoped).
- UI for super admin to switch agencies.
- Moving existing client logins between agencies.

Ready to run the migration?