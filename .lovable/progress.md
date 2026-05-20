# Progress log

Running log of what's been built so far. Newest at the bottom.

## 1. App shell + client shell
- Built admin app shell (`src/components/app-shell.tsx`) and a separate client-portal shell (`src/components/client-shell.tsx`) with distinct nav for client users.

## 2. Client account creation (real, not mocked)
- Added `createClientAccount` server function in `src/lib/team.functions.ts`:
  - `supabaseAdmin.auth.admin.createUser({ email_confirm: true })`
  - Updates `profiles` with `full_name`, `company_name`, `status: 'active'`
  - Replaces any existing `user_roles` with a single `client` role
- Rebuilt the "Onboard client" modal in `src/routes/admin.clients.tsx` as a one-step form: Company name, Contact person, Login email, Password (with show/hide, min 8 chars). Loading spinner, inline error, toast on success.

## 3. Agencies per client
- Extended `Client` in `src/lib/mock-data.ts` with `agencies: ClientAgencyEngagement[]` (id, name, initials, color, SPOC, since year, positions list with `external?` flag).
- Seeded every client with 1–3 agencies (TalentFlow = us, plus Antal, Michael Page, Randstad, ABC Consultants) and a few external positions per competitor so the vendor landscape feels real.
- `src/routes/admin.clients.tsx`: added "N agencies" stat to each client row.
- `src/routes/clients.$clientId.tsx`: added **Agencies engaged** section above Open Positions. Each agency renders as an expandable card (avatar, name, SPOC, since year, counters). Click → inline positions table. Internal positions link to `/positions/$positionId`; external positions show a small "Handled by {agency}" tag and are non-clickable.

## 4. Client dashboard funnel — hide internal sourcing
- `src/routes/client.index.tsx`: replaced 4 KPIs with 5-tile funnel (Shared / Shortlisted / Interviewed / Offered / Rejected). Same 5-stage strip on per-position rows. Dropped "Placed YTD" (now duplicative with Offered).
- `src/routes/client.positions.tsx`: hid the "sourcing" step from the visible breakdown. Positions internally in Sourcing display as "Received" to the client. Visible stages: Shared → Shortlisted → Interviewed → Offered → Joined.
- `src/routes/client.reports.tsx`: removed "Sourced" bar and stat. Conversion now = `joined / shared` (safe-divide). Funnel chart starts at "Profiles shared".

## Files touched
- `src/components/app-shell.tsx`
- `src/components/client-shell.tsx`
- `src/lib/team.functions.ts`
- `src/lib/mock-data.ts`
- `src/routes/admin.clients.tsx`
- `src/routes/clients.$clientId.tsx`
- `src/routes/client.index.tsx`
- `src/routes/client.positions.tsx`
- `src/routes/client.reports.tsx`

## Not done / open
- No DB migration for agencies yet — still mock-data only.
- "Double-click to open a dedicated agency page" was implemented as inline expand on the client detail page instead (same mental model, no dead-end nav). Can be promoted to its own route if needed.
