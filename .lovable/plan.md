## Goal

Replace the mock impersonation system with real authentication. Three roles — **Admin**, **Recruiter**, **Client** — decide which portal and which actions a signed-in user can reach. Existing mock recruiters/clients/positions/messages stay as seed data; only the access layer becomes real.

## 1. Enable Lovable Cloud + email auth

- Turn on Lovable Cloud.
- Configure email/password sign-in (no email confirmation in dev so testing is instant).
- No social providers.

## 2. Database schema

Two new tables (RLS on, policies via `has_role` security-definer function — never store role on profiles):

- `profiles` — `id` (FK `auth.users`), `full_name`, `email`, `client_company_id` (nullable, for client users), `status` ('pending' | 'active' | 'rejected'), timestamps. Auto-created via `handle_new_user` trigger on `auth.users` insert.
- `user_roles` — `id`, `user_id`, `role` (enum `app_role`: 'admin' | 'recruiter' | 'client'), unique(user_id, role).
- Enum `app_role` + SQL function `has_role(_user_id uuid, _role app_role)` (SECURITY DEFINER, stable).
- Seed: first signup is auto-promoted to `admin` (trigger checks if `user_roles` is empty). All subsequent signups start as `client` with `profiles.status = 'pending'` awaiting admin approval.

## 3. Auth surface (routes)

New public routes:
- `/login` — email + password, redirects by role (admin/recruiter → `/dashboard`, client → `/client`).
- `/signup` — email + password + full name + (optional) company name; creates a pending client account.
- `/pending` — shown when a client logs in but `profiles.status != 'active'`.

Guards:
- `_authenticated.tsx` pathless layout — redirects to `/login` if not signed in.
- `_authenticated/_agency.tsx` — requires `admin` OR `recruiter` role, redirects clients to `/client`.
- `_authenticated/_client.tsx` — requires `client` role with `status = 'active'`, redirects others.
- Move existing agency routes (`dashboard`, `tasks`, `admin.clients`, `messages`, `positions`, `ongoing`, `interviews`, `pipeline`, `database`, `closed`, `billing`, `team`, `me`, `scout`) under `_authenticated/_agency/`.
- Move client portal routes (`client.*`) under `_authenticated/_client/`.
- Landing `/` stays public; its CTAs route to `/login` instead of straight into portals.

## 4. Role wiring in the app

- New `useAuth()` hook backed by `supabase.auth` + `onAuthStateChange` (listener set up BEFORE `getSession`, set up once in `__root.tsx`, invalidates router + query cache on change).
- New `useMyRole()` / `useCan(permission)` that read from a `getMyRoles` server fn (uses `requireSupabaseAuth`, returns roles + profile).
- Refactor `src/lib/ops/access.ts`:
  - Drop `setCurrentRecruiter` impersonation.
  - Keep `DEFAULT_ROLES` but collapse to 3 entries (Admin = all perms; Recruiter = candidates/positions/clients view+edit, pipeline move/share, team view; Client = no agency perms).
  - `useCurrentRecruiter` now derives from the signed-in user's profile, falling back to a mock recruiter only for display name/initials if no roster match exists.
- `AppShell` sidebar items already filter by `can(perm)` — verify recruiter sees the right subset; remove the "Impersonate (demo)" dropdown block; add a real "Sign out" that calls `supabase.auth.signOut()`.
- `ClientShell` similarly gets a real sign-out and shows the signed-in client's name.

## 5. Admin approval UI

- Extend `/admin/clients` with a "Pending access requests" panel listing `profiles` where `status = 'pending'`. Admin can **Approve** (sets status active + links `client_company_id` to an existing client record) or **Reject**.
- Approval/rejection is a `createServerFn` protected by `requireSupabaseAuth` that also re-checks `has_role(auth.uid(), 'admin')` server-side.
- An admin can also promote a user to recruiter from the Roster page (`/team`) via a new "Invite recruiter" action that creates a pending invite (out of scope for v1 — for now admins manually insert a `user_roles` row through a small "Manage roles" dialog gated by `roles.manage`).

## 6. Sign-out + session UX

- Top-right avatar dropdown: real account info from `profiles`, "Sign out" calls `supabase.auth.signOut()` then navigates to `/login`.
- `onAuthStateChange` SIGNED_OUT → router.invalidate + queryClient.clear.

## 7. Technical notes

- Use `requireSupabaseAuth` middleware on every server fn that reads/writes user-scoped data.
- All role checks inside server fns use the SQL `has_role` function (never trust client-sent role).
- RLS policies:
  - `profiles`: user can select/update own row; admins can select/update all (via `has_role`).
  - `user_roles`: user can select own rows; only admins can insert/delete (via `has_role`).
- `attachSupabaseAuth` registered in `src/start.ts` global `functionMiddleware`.
- Add `beforeLoad` session-hydration gate (`supabase.auth.getUser()`) on `_authenticated` so protected loaders don't 401 on first paint.
- Mock seed data (`mock-data.ts`, `chat-data.ts`, `client-data.ts`, ops store) stays untouched — auth gates the UI but the in-memory data layer is unchanged.

## Out of scope (for this pass)

- Password reset / magic links (can add later).
- Email invites for recruiters (admins promote manually for now).
- Migrating mock data into Postgres.
- Per-client data isolation on the mock data (client users see the same demo dataset; real per-tenant scoping comes when data is migrated to DB).
