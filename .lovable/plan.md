## Goal

1. Remove the standalone "Roles & Permissions" sidebar entry and merge it into **My Team** as an inline tab (keeps one place to manage people + access).
2. Let clients create their own **custom roles** (name + permission set) in addition to the built-in Admin / Recruiter / Viewer, and assign them to teammates.

---

## UX changes

**Sidebar (`client-shell.tsx`)**
- Remove the `Roles & Permissions` nav item. Keep only `My Team`.

**My Team page (`client.my-team.tsx`)** — single page, two tabs:
- **Members** (current table) — invite, change role, remove.
- **Roles & Permissions** — lists Admin (locked, full access), Recruiter, Viewer, and any custom roles the client created. Each row shows permission checkboxes + Save. A "+ New role" button opens a dialog (name + starting permissions) to create a custom role. Custom roles can be renamed or deleted (deletion blocked if assigned to any member).

**Invite + Change-role dropdowns**
- Role dropdown now shows the built-in three plus all custom roles for this client.

**Old route `/client/my-team/permissions`**
- Deleted. Anyone landing on it redirects to `/client/my-team?tab=permissions`.

---

## Data model

New table `public.client_custom_roles`:
- `client_id` (fk → clients), `name` (text, unique per client), `permissions` (text[]), timestamps.
- RLS: client owner + active `client_members` of that client can read; only client owner can insert/update/delete.
- Grants: `authenticated` (full CRUD scoped by RLS), `service_role` (all).

Alter `public.client_members`:
- Add `custom_role_id uuid references client_custom_roles(id) on delete set null` (nullable).
- Make existing enum `role` nullable.
- Add CHECK: `(role IS NOT NULL) <> (custom_role_id IS NOT NULL)` — exactly one assigned.

No backfill needed; current rows keep their enum role.

---

## Server functions (`client-team.functions.ts`)

Add:
- `listClientCustomRoles()` — returns `{ id, name, permissions }[]` for the client.
- `createClientCustomRole({ name, permissions })`
- `updateClientCustomRole({ id, name?, permissions? })`
- `deleteClientCustomRole({ id })` — errors if any member references it.

Update:
- `listClientMembers` — also return `custom_role_id` and (joined) custom role name; UI shows whichever is set.
- `inviteClientMember` and `updateClientMemberRole` — accept either `role: enum` or `customRoleId: uuid` (exactly one), validate ownership before assigning.

`CLIENT_PERMISSIONS` constant stays as-is; it's the available permission catalog used both by built-in role editing and custom-role creation.

---

## Out of scope

- Enforcing the permissions in other client routes (this PR keeps the existing behavior; permission gating across pages stays a follow-up).
- Agency-side roles.
