# Project overview — Recruitment Agency Workspace

A multi-tenant SaaS for a recruitment agency ("TalentFlow"-style) plus a separate portal for the agency's client companies. One codebase, two distinct experiences gated by role.

## Stack

- **Frontend**: React 19 + TanStack Start v1 (Vite 7), TanStack Router file-based routing, Tailwind v4 with semantic tokens in `src/styles.css`, shadcn/ui primitives, framer-motion for animation, lucide icons.
- **Backend**: Lovable Cloud (Supabase under the hood). Server-side logic via TanStack `createServerFn` — no edge functions.
- **Auth**: Supabase Auth, email + password. Role-based access using a separate `user_roles` table (never on profiles).
- **Deploy target**: Cloudflare Workers (edge).

## Users & roles

Three application roles defined in the `app_role` enum:

| Role | Lands on | Shell | Purpose |
|---|---|---|---|
| `admin` | `/dashboard` | `AppShell` | Agency owner / ops. Full access to clients, recruiters, billing, roster, permissions. |
| `recruiter` | `/me` | `AppShell` | Agency employee. Permission-gated nav (positions, pipeline, interviews, DB). |
| `client` | `/client` | `ClientShell` | The hiring company. Sees only their own requirements, candidates, reports. |

Permissions live in `role_permissions.permissions[]` and are enforced with `useCan(perm)` in the UI + RLS in the DB. The DB has a `has_role(uid, role)` SECURITY DEFINER helper used by every policy to avoid recursive RLS.

## Database (public schema)

- **profiles** — 1:1 with `auth.users`. Holds `full_name`, `email`, `company_name`, `status` (`pending` | `active` | `disabled`). RLS: users see/edit their own; admins + recruiters can view all; admins can update any.
- **user_roles** — `(user_id, role)` unique. Roles assigned/revoked only by admins.
- **role_permissions** — per-role permission string array. Readable by all authenticated users; mutable only by admins.

All app-internal business data (clients, positions, candidates, agencies) is still **mock data** in `src/lib/mock-data.ts` and `src/lib/client-data.ts` — no DB tables yet.

## Agency portal (`AppShell`)

Nav: Dashboard · Tasks · Clients · Messages · Open Requirements · Ongoing · Interviews · Pipeline · Candidate DB · Closed · Billing · Recruiter Roster · Recruiter Activity.

Key surfaces:

- **`/admin/clients`** — Client list with health metrics (closures YTD, revenue YTD, agencies engaged, last mandate / last closure days). "Onboard client" modal creates a real Supabase auth user with `client` role + active profile (server fn `createClientAccount` using `supabaseAdmin`).
- **`/clients/$clientId`** — Per-client detail. Includes an **Agencies engaged** section: every client lists the recruitment agencies they work with (TalentFlow + competitors like Antal, Michael Page, Randstad, ABC Consultants). Each agency card expands inline to show the positions handled by that vendor. Internal positions link to `/positions/$positionId`; external (competitor) positions are read-only with a "Handled by {agency}" tag.
- **`/positions`, `/positions/$id`, `/pipeline`, `/interviews`, `/database`** — recruiter workflow.
- **`/team`, `/activity`** — recruiter roster + activity feed.
- **`/billing`** — client-level revenue and invoice views.

## Client portal (`ClientShell`)

Nav: Overview · My Requirements · Pipeline · Interviews · Placements · Reports · Activity · Account Team · Messages · Upload JD · Documents.

Hard rule applied across all client-facing views: **the client never sees internal "sourcing" counts**. They see what the agency has *shared* with them and onwards:

- **`/client`** (Overview) — 5-tile funnel KPI: Shared / Shortlisted / Interviewed / Offered / Rejected. Per-position rows show the same 5-stage strip.
- **`/client/positions`** — Visible stages: Shared → Shortlisted → Interviewed → Offered → Joined. Positions internally in "Sourcing" surface to the client as "Received".
- **`/client/reports`** — Funnel chart starts at "Profiles shared". Conversion = `joined / shared` (safe-divide). No "Sourced" bar or stat.

Client users can switch between accounts (if linked to more than one company) via the header — selection persists in `portal-state`.

## Domain model (mock-data.ts)

- `Client` — id, name, industry, SPOC, open positions, active candidates, last mandate/closure days, closures YTD, revenue YTD (INR), **`agencies: ClientAgencyEngagement[]`**.
- `ClientAgencyEngagement` — agency identity (id, name, initials, color), SPOC, since year, **`positions: ClientAgencyPosition[]`** (id, title, status, openings, candidates shared, closures, `external?` flag).
- `Position` — clientId, title, location, experience band, salary band, openings, priority, status (`open` | `in_progress` | `interviews` | `closed`), skills, candidates.
- `Candidate` — name, role, experience, location, match score, stage on the 8-step `PIPELINE_STAGES` ladder (Sourcing → Recruiter Shortlist → Shared with Client → Client Shortlist → Interview Scheduled → Rounds → Offered → Closed).

Helpers: `getClient`, `getPosition`, `positionsByClient`, `agenciesForClient`, `isClientInactive` (using `INACTIVITY_MANDATE_DAYS = 60` and `INACTIVITY_CLOSURE_DAYS = 90`).

## Server functions (`src/lib/*.functions.ts`)

- `team.functions.ts` — `createClientAccount` (admin: provision client user end-to-end), recruiter management.
- `scout.functions.ts`, `scout-match.functions.ts` — AI-assisted candidate sourcing / JD-to-candidate matching via Lovable AI.

All protected fns use the `requireSupabaseAuth` middleware; `attachSupabaseAuth` is registered globally in `src/start.ts` so the browser attaches the bearer token automatically.

## Layout & shells

- `AppShell` — sidebar with role-filtered nav, header with global search, notifications, recruiter status pill (Available / Active / Break / Offline), user menu. Wrapped in `<AuthGate variant="agency">`.
- `ClientShell` — sidebar pinned to the selected client account, header with breadcrumbs back to last agency view (when previewing as admin), account switcher, user menu. Wrapped in `<AuthGate variant="client">`.

`AuthGate` redirects unauthenticated users to `/login` and routes role mismatches to the correct portal.

## Design system

- Tokens-only — components never use raw colors. All palette / radius / shadow / gradient lives in `src/styles.css` as `oklch` tokens (`--background`, `--foreground`, `--primary`, `--accent`, `--success`, `--warning`, `--info`, etc.).
- Dark + light themes share the same semantic API.
- Animations: framer-motion for page transitions and the funnel tiles.

## Status

- Auth + role gating: **real (Cloud-backed)**.
- Client onboarding: **real (creates auth user + profile + role)**.
- Everything else (clients, positions, candidates, agencies, billing, pipeline state): **mock data**, ready to be migrated table-by-table.

## Out of scope / next up

- Migrate `clients`, `positions`, `candidates`, `agency_engagements` to real tables with RLS scoped by `client_id` / agency membership.
- Wire JD upload (`/client/upload`) to storage + a parsing server fn.
- Real messaging (currently mocked feed).
- Promote per-agency drill-down from inline-expand on the client detail page into its own `/clients/$clientId/agencies/$agencyId` route once data is real.