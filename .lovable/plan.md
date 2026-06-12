# Recruitment Model + Client Team & Permissions

Two coordinated additions, no removal of existing features.

## Part A — Recruitment Model on each JD

When a client uploads or edits a JD, ask **how they want this role recruited**:

- **Agency** — current default. Agency sources/screens, client reviews.
- **Self** — client's own team handles sourcing and screening; agency only provides platform/ATS.
- **Hybrid** — both client team and agency can work the same vacancy; submissions are tagged by source.

### Data

New migration on `public.positions`:
- `recruitment_model` enum (`agency` | `self` | `hybrid`), NOT NULL, default `agency` (keeps existing rows valid).

`applications` already has a source-ish path; we'll add a `submitted_by_kind` text column (`agency` | `client`) defaulting to `agency` so Hybrid submissions are separable in pipeline + reports. No other schema change.

### Server (`src/lib/positions.functions.ts`)

- Extend `PositionRow` and `upsertSchema` with `recruitment_model`.
- `listPositions` accepts optional `recruitmentModel` filter.

### UI (additive only)

- `client.upload.tsx`: required **Recruitment Model** select with 3 cards/options + short description text. Default `agency`.
- `client.positions.$positionId.tsx` and `positions.$positionId.tsx`: show model badge in header; allow editing from a small "Change model" action on the client side.
- `client.positions.tsx` + `positions.tsx`: badge in row meta + a "Model" filter dropdown next to existing status tabs.
- `pipeline.tsx`: per-candidate chip showing "From: Agency / Client Team" when the position is Hybrid.
- `client.reports.tsx`: small "By recruitment model" breakdown card.

### Badge colors (existing semantic tokens)

- Agency → green (`success`)
- Self → blue (`info`)
- Hybrid → orange (`warning`)

### Workflow rules

- **Agency**: unchanged from today.
- **Self**: agency-side recruiter assignment UI is hidden on that position; client team members can be assigned instead (see Part B). Agency view still shows the position read-only for support.
- **Hybrid**: both assignment paths are available. Candidate cards show source badge.

## Part B — Client Team & Permissions

A new client-portal section so a client admin can add their own teammates and control what each can do. This is independent from the agency's `team` and from the existing read-only "Account Team" page (which stays — it lists the agency recruiters staffed on the account).

### Data (new migration)

New enums + tables, all scoped to a single client:

- enum `client_member_role`: `client_admin`, `client_recruiter`, `client_viewer`.
- table `client_members`
  - `client_id` (FK clients)
  - `user_id` (FK auth users)
  - `role client_member_role`
  - `invited_email`, `status` (`active` | `invited` | `disabled`)
  - timestamps
  - unique `(client_id, user_id)`
- table `client_role_permissions`
  - `client_id`, `role client_member_role`, `permissions text[]`
  - unique `(client_id, role)`
- Security-definer helper `public.is_client_member_of(_client_id, _user_id)` returning bool, used by RLS on the two new tables and reused to extend existing client-scoped policies so teammates inherit the same access as the owning client user (positions, applications, candidates, interviews, messages, documents — read; write gated by permissions in app layer + RLS check).
- Grants per project convention (`authenticated`, `service_role`).
- Trigger keeps the existing `clients.user_id` as the implicit `client_admin` (auto-seeded on insert into `client_members`).

Existing tables and RLS for non-client surfaces are untouched.

### Server functions (`src/lib/client-team.functions.ts`, new)

All protected with `requireSupabaseAuth` + a `client_admin`-only guard:
- `listClientMembers()` — members + role + status.
- `inviteClientMember({ email, fullName, role, password })` — uses admin client to create the auth user (email-confirmed), inserts profile, links into `client_members`.
- `updateClientMemberRole({ userId, role })`
- `removeClientMember({ userId })`
- `getClientRolePermissions()` / `updateClientRolePermissions({ role, permissions })`
- `assignClientMemberToPosition({ positionId, userId })` — only valid when position is `self` or `hybrid`.

A new nullable `positions.client_assignee_id` column stores the client-side assignee (separate from the existing `assigned_recruiter_id`, which remains the agency recruiter).

### Permission catalog (initial)

Granular flags surfaced as checkboxes in the permissions UI:
- `positions.view`, `positions.create`, `positions.edit`
- `candidates.view`, `candidates.submit`, `candidates.shortlist`
- `interviews.schedule`, `interviews.feedback`
- `messages.send`, `documents.upload`
- `team.manage` (admin-only, immutable)

Defaults: `client_admin` = all; `client_recruiter` = view/submit/shortlist/schedule/feedback/messages/documents; `client_viewer` = view only.

### UI (new routes under client portal)

Sidebar (`src/components/client-shell.tsx`): add a new group "My Team" with two links — **Team Members**, **Roles & Permissions** — placed below the existing "Account Team" entry (which stays and continues to mean "agency staff on my account").

- `src/routes/client.my-team.tsx` (new)
  - List of teammates with avatar, role pill, status, last activity.
  - "Invite teammate" dialog: email, name, role, temporary password.
  - Row actions: change role, disable, remove.
- `src/routes/client.my-team.permissions.tsx` (new)
  - Matrix: rows = roles (excluding admin which is read-only), columns = permission flags, save per row.
- `src/routes/client.positions.$positionId.tsx`: when model is `self`/`hybrid`, add an "Assigned (your team)" select listing client members; saves `client_assignee_id`.

Existing `client.team.tsx` is renamed in copy only (still route `/client/team`, label stays "Account Team") — no code restructure.

## Backwards compatibility

- All existing positions default to `agency` → today's workflow unchanged.
- Existing client users become `client_admin` automatically; nothing breaks for solo clients.
- Agency routes, billing, scout, interviews, pipeline keep working as-is.

## Technical notes

```text
positions
 ├─ recruitment_model   enum  NOT NULL default 'agency'
 ├─ client_assignee_id  uuid  null    (FK auth.users, client-side owner)
 └─ assigned_recruiter_id (unchanged, agency-side owner)

applications
 └─ submitted_by_kind   text  NOT NULL default 'agency'  ('agency'|'client')

client_members(client_id, user_id, role, status, invited_email, ...)
client_role_permissions(client_id, role, permissions text[])
```

Files touched:
- new migration (schema + helper fn + RLS)
- `src/lib/positions.functions.ts` (model field + filter + client assignee)
- `src/lib/client-team.functions.ts` (new)
- `src/components/ui-bits.tsx` (RecruitmentModelBadge)
- `src/components/client-shell.tsx` (sidebar entries)
- `src/routes/client.upload.tsx` (model picker)
- `src/routes/client.positions.tsx`, `client.positions.$positionId.tsx` (badge, filter, client assignee)
- `src/routes/positions.tsx`, `positions.$positionId.tsx` (badge + filter)
- `src/routes/pipeline.tsx` (source chip for hybrid)
- `src/routes/client.reports.tsx` (model breakdown)
- `src/routes/client.my-team.tsx` (new)
- `src/routes/client.my-team.permissions.tsx` (new)
