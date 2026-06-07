## Goal

A `/superadmin` portal — separate from the existing agency app — for your SaaS company to manage tenant recruitment agencies, their plans, trials, usage, and support requests. Manual billing for now (no Stripe yet).

## 1. Database (one migration)

**Extend role enum**
- `ALTER TYPE public.app_role ADD VALUE 'super_admin'`.

**New enums**
- `agency_status`: `trial | active | suspended | rejected | pending`
- `agency_plan`: `starter | professional | enterprise`
- `ticket_status`: `open | in_progress | resolved | closed`
- `ticket_type`: `support | billing | feature_request`

**New tables** (all with RLS + GRANTs, `super_admin`-only via `has_role`):

- `agencies` — `id, name, slug, owner_user_id (→ auth.users), status, plan, trial_ends_at, mrr_cents, notes, created_at, updated_at`
- `agency_members` — links existing recruiter/admin profiles to an agency (`agency_id, user_id, role_in_agency`). Backfilled from current users in a single "default agency" so existing data keeps working.
- `support_tickets` — `id, agency_id, type (ticket_type), subject, body, status, priority, created_by, assigned_to, created_at, updated_at`

**RLS**: only `super_admin` can read/write `agencies`, `agency_members`, `support_tickets`. The existing agency app is untouched (no tenant_id wired into positions/candidates yet — that's a future phase).

**Seed**: insert one default agency and bind all existing recruiter/admin/client users to it so dashboards have real numbers from day one.

## 2. Server functions (`src/lib/superadmin.functions.ts`)

All gated by a new `requireSuperAdmin` middleware (wraps `requireSupabaseAuth` + `has_role(super_admin)` check).

- `listAgencies`, `getAgency(id)`
- `createAgency({ name, ownerEmail, plan, trialDays })` — admin-creates owner user, assigns `admin` role, creates `agencies` row in `trial` status
- `updateAgencyStatus(id, status)` — approve / reject / suspend
- `updateAgencyPlan(id, plan)`
- `deleteAgency(id)`
- `extendTrial(id, days)`
- `getRevenueStats()` — MRR/ARR derived from `agencies.mrr_cents` + status, active subscription count, upcoming renewals
- `getUsageStats(agencyId?)` — counts from existing tables (`profiles` w/ recruiter role, `clients`, active `positions`, `placements`); AI usage shows "—" until tracked
- `listTickets`, `updateTicket`

## 3. Routes (`src/routes/superadmin.*.tsx`)

New `SuperAdminShell` (sidebar, distinct from `AppShell`/`ClientShell`) with a `<SuperAdminGate>` guard that checks `roles.includes("super_admin")` and otherwise redirects to `/`.

- `/superadmin` — overview (MRR, ARR, active agencies, trials expiring, ticket counts)
- `/superadmin/agencies` — table: name, owner, plan, status, MRR, trial ends, actions (approve / suspend / delete / extend trial)
- `/superadmin/agencies/$id` — detail: members, usage, billing notes, status history
- `/superadmin/agencies/new` — create agency + owner
- `/superadmin/subscriptions` — manual plan management per agency (Starter/Pro/Enterprise descriptions + assign)
- `/superadmin/revenue` — MRR/ARR charts, renewal tracker
- `/superadmin/usage` — global usage table per agency (recruiters, clients, jobs, placements, AI usage placeholder)
- `/superadmin/support` — tickets list with type filter (Support / Billing / Feature Request), assign + status update

## 4. Auth & entry

- `AuthGate` gets a `"super_admin"` variant; `auth-context` already exposes `roles`.
- Login flow: after sign-in, super_admins redirect to `/superadmin` (precedence: super_admin → client → agency).
- One-time bootstrap: a script/SQL to grant `super_admin` to your own user (you tell me the email or I make the first existing admin a super_admin in the same migration).

## 5. What's stubbed for now

- **Billing**: plan/MRR are manual fields. Stripe/Paddle wiring is a separate future task.
- **AI usage**: column rendered as "—" with a tooltip "Tracked once AI metering ships."
- **Per-tenant data isolation**: not in this phase. The `agencies` + `agency_members` tables are in place so a future phase can add `agency_id` to positions/candidates/etc. with backfills.

## Technical details

- Tables created in `public` with `GRANT SELECT,INSERT,UPDATE,DELETE … TO authenticated; GRANT ALL TO service_role`; RLS policies use `public.has_role(auth.uid(), 'super_admin')`.
- `ALTER TYPE … ADD VALUE` runs in its own statement before any usage (Postgres requires this; the migration tool handles it via separate statements).
- `requireSuperAdmin` middleware lives in `src/integrations/supabase/superadmin-middleware.ts` and reuses the supabase client injected by `requireSupabaseAuth`.
- All super_admin server fns use `supabaseAdmin` for cross-tenant reads where RLS would otherwise filter rows.
- New route files follow flat dot-naming: `superadmin.tsx` (layout), `superadmin.index.tsx`, `superadmin.agencies.tsx`, `superadmin.agencies.$id.tsx`, etc.

## Open question before I build

Who should become the first super_admin? Pick one:
- (a) the first user in `user_roles` who currently has `admin` (auto-promoted in the migration), or
- (b) a specific email you'll give me now.
