## Goal

Three independent fixes to the client portal:
1. Team members (invited via `client_members`) currently see "Client" or their own name in the sidebar/header because their `profiles.company_name` is null. Show the parent client's company name instead.
2. Replace the client Overview dashboard with a leaner, task-focused view when the signed-in user is a team member (not the client owner).
3. In the Scout/Sourcing results, hide candidates with `matchScore < 50` so only above-50% AI matches surface.

---

## 1. Team members see their company

**Server**: extend `useAuth` data with the resolved company name.

- `src/lib/client-team.functions.ts`: add a new lightweight serverFn `getMyClientContext` (auth-required) that returns `{ clientId, companyName, isOwner, isTeamMember }`.
  - If the user owns a `clients` row → `{ isOwner: true, companyName: clients.company_name, clientId }`.
  - Else if the user has an active `client_members` row → join to that client → `{ isTeamMember: true, companyName: <client>.company_name, clientId }`.
  - Else `{}` (agency users, super admins).

**Client wiring**:
- `src/lib/auth/auth-context.tsx`: after profile/roles load, also fetch `getMyClientContext` for `client`-role users; expose `clientContext` on the auth context (`{ companyName, isOwner, isTeamMember, clientId } | null`).
- `src/components/client-shell.tsx`: replace the four `profile?.company_name` reads with `clientContext?.companyName ?? profile?.company_name ?? ...` so team members see the parent client's company in:
  - sidebar header brand
  - mobile header logo block
  - user dropdown trigger subtitle
  - dropdown label subtitle
  - `companyInitials` derived from the resolved name

---

## 2. Distinct dashboard for team members

- New file `src/components/client-team-dashboard.tsx`: a smaller dashboard focused on what an individual teammate actually does:
  - Greeting using their `full_name`, with the parent company name as the secondary line.
  - Three small KPI tiles scoped to apps they should act on: "Awaiting your review" (stage `shared_with_client`), "Interviews this week", "Open positions".
  - "Recent positions" list (top 5) linking to `/client/positions/$id`.
  - Quick links: Pipeline, Interviews, Messages. No "Upload JD" CTA (positions creation stays an owner action by default).
- `src/routes/client.index.tsx`: branch on `clientContext.isTeamMember` (or `!isOwner` when both client-role). Owner keeps the existing `<Dashboard />`. Team members render `<ClientTeamDashboard />`.
- Reuse the existing `listPositions` / `listApplications` server fns — they already RLS-scope to the user's client.

Out of scope: a permission-driven nav trim. Sidebar entries stay the same; only the landing page changes.

---

## 3. Scout: show only ≥50% AI matches

- `src/lib/apify.functions.ts` (`listSourcedMatches` handler, ~line 60):
  - Add `.gte("match_score", 50)` to the position-scoped query so anything below 50 (and `NULL`) is filtered server-side.
  - In the fallback skills/title branch (lines 100-146) candidates have `matchScore: null` (no AI score yet) — leave that branch as-is so it still shows raw matches when no scoring exists, OR drop it from the result. **Default**: keep the fallback branch (it only runs when there are no scored matches at all); if you'd rather hide unscored entirely, say so and we'll drop it too.
- No UI change in `src/components/scout-results.tsx` — it just renders what it receives.

---

## Technical notes

- `getMyClientContext` is read-only and cheap; cache it via React Query keyed by `["my-client-context", userId]` inside the auth provider's load step, similar to the existing `loadProfileAndRoles` call.
- Company-name fallback chain stays: `clientContext.companyName → profile.company_name → profile.full_name → "Client Portal"`, so existing single-user clients are unaffected.
- The `≥ 50` threshold is applied server-side so pagination/limit behaves correctly; no need to over-fetch and filter client-side.

## Out of scope
- Changing what permissions team members have (still governed by `client_role_permissions`).
- Editing the apify scoring prompt itself or persisted scores.
- Agency-side scout views.
