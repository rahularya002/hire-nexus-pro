## Goals

1. Support the four recruiter roles already shown in the Roles & Permissions UI (Admin, Lead Recruiter, Senior Recruiter, Recruiter) — plus Client — end-to-end (DB + auth + UI).
2. Make the permission checkboxes actually gate features across the app (navigation, buttons, routes).
3. Replace email invites with an admin-creates-account flow: admin types name + email + password + role, the teammate signs in with those credentials immediately.

---

## 1. Role model — 4 recruiter roles + client

Today the DB enum `app_role` only has `admin`, `recruiter`, `client`. We need:

- `admin`
- `lead_recruiter`
- `senior_recruiter`
- `recruiter`
- `client`

Migration:
- `ALTER TYPE public.app_role ADD VALUE 'lead_recruiter';` and `'senior_recruiter'` (Postgres requires separate statements, can't be in a transaction with usage).
- Update `handle_new_user` trigger: first user → `admin`; everyone else → `client` pending (unchanged).
- Add a `role_permissions` table so permission edits in the UI actually persist and are enforceable server-side:
  ```
  role_permissions (role app_role PK, permissions text[] not null)
  ```
  Seed it with the four default permission sets currently hardcoded in `src/routes/team.tsx`. Admin always implicitly has all permissions (don't store, just short-circuit).
- RLS: everyone authenticated can `SELECT` permissions for their role; only admins can `UPDATE`.

Update `AppRole` type in `src/lib/auth/auth-context.tsx` to include the two new values, and extend the context to expose `permissions: string[]` (union of the user's roles' permission sets, computed from `role_permissions` on login).

## 2. Permission enforcement

Add a single source of truth:

- `useCan(perm)` hook in `src/lib/auth/auth-context.tsx` that returns `true` if user is admin OR if the perm is in `auth.permissions`.
- A `<RequirePerm perm="...">` wrapper for routes that should be entirely hidden.

Apply across the app:

| Route / UI | Required perm |
|---|---|
| `/team` (roster tab) | `team.view` |
| `/team` Invite button + Roles tab | `roles.manage` (admin only in practice) |
| `/positions`, `/positions/$id` create button | `positions.view` / `positions.create` |
| `/positions/$id` "Assign recruiter" | `positions.assign` |
| `/pipeline` move stage actions | `pipeline.move` |
| `/pipeline` "Share to client" | `pipeline.share` |
| `/clients/$id` and admin client mgmt | `clients.view` / `clients.manage` |
| `/database` candidate edit/delete | `candidates.edit` / `candidates.delete` |
| `/billing*` | `billing.manage` |
| Sidebar items in `app-shell.tsx` | hide if user lacks the view perm |

Server-side: add a `requirePerm(perm)` helper alongside `requireSupabaseAuth` that checks role + `role_permissions`; apply it inside any future write server functions (set up the helper now even if only one or two functions use it today).

Wire the Roles & Permissions UI to persist changes: replace the `useState<Role[]>` with a `getRolePermissions` / `updateRolePermissions` server function pair calling `role_permissions`.

## 3. Admin creates account with credentials (replace invite)

Rewrite `src/lib/team.functions.ts`:

- Rename `inviteTeamMember` → `createTeamMember`.
- Input: `{ email, password (min 8), fullName, role: 'admin' | 'lead_recruiter' | 'senior_recruiter' | 'recruiter' }`.
- Use `supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } })` so the account is active immediately, no email step.
- Activate the profile row and replace the default `client` role with the chosen role (same as today).
- Return the new userId; on the client, toast with "Account created — share these credentials with <name>".

Update `src/routes/team.tsx`:

- Dialog title → "Add teammate".
- Add a password field (with show/hide toggle + "Generate" button that fills a random strong password the admin can copy).
- Role select → 4 options (Admin, Lead Recruiter, Senior Recruiter, Recruiter), mapped to the new enum values.
- After success, show the email + password in a "Copy credentials" confirmation panel so the admin can hand them over.

## Technical notes

- Enum values can't be added inside the same transaction that uses them, so the migration has two parts: (a) `ALTER TYPE ... ADD VALUE` for both new values, (b) a follow-up migration that creates `role_permissions`, seeds it, and adds RLS. Two separate migration files.
- `auth-context.tsx` needs a second query (`role_permissions` for the user's roles) and to expose `permissions` + `can()` so we don't read them in every component.
- `src/lib/ops/access.ts` still references the mock recruiter store — leave the impersonation helpers alone but stop using them; gate everything on the real `useAuth()` / `useCan()` instead. The mock data stays as seed only.

## Out of scope

- Migrating the existing seed/mock recruiters in `src/lib/ops/store.ts` to real auth users (still demo data).
- Password reset flow for teammates whose admin-set password leaks — they can use the existing login + forgot-password if/when we add it.