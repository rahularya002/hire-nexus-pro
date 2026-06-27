# Reseed mock data

## Keep
- **Users**: only `admin@gmail.com`, `agency1@gmail.com`, `client1@gmail.com`. Everyone else (recruit, agency, client, test, test1, test2, hr) gets deleted from `auth.users` + `profiles` + `user_roles`.
- **Agencies**: keep `Default Agency` (admin's) and `Agency 1` (agency1's).

## Wipe (in dependency order)
Delete all rows from: `notifications`, `tasks`, `activities`, `messages`, `message_threads`, `documents`, `invoice_line_items`, `invoices`, `placements`, `interviews`, `applications`, `position_sourced_matches`, `position_sourcing_runs`, `sourced_candidates`, `candidates`, `client_role_permissions`, `client_custom_roles`, `client_members`, `client_billing_terms`, `positions`, `clients`, `job_applications`, `job_post_channels`, `job_posts`, `recruiter_login_events`, `interview_round_templates`, `google_calendar_connections`, `support_tickets`.

## Reseed — medium volume, mixed industries

### Agency 1 (agency1@gmail.com is admin/owner)
Seed under `agency_id = 03e1341b...`:

- **6 clients** owned by Agency 1:
  - **AI Tech** (SaaS) — owned by `client1@gmail.com` (so they see it in client portal)
  - **NovaPay** (Fintech)
  - **Lumen Health** (Healthtech)
  - **Kettle & Co** (D2C retail)
  - **OrbitLogix** (Logistics)
  - **Verdant Energy** (Cleantech)
  - Each gets billing terms (15% fee, NET 30, 90-day guarantee).
- **15 positions** spread across the 6 clients (mix of open / in_progress / interviews / closed), with realistic titles (Senior Backend Engineer, Product Designer, GTM Lead, Data Scientist, RN Manager, Supply Chain Lead, etc.), salary ranges, locations (Bengaluru / Mumbai / Delhi / Remote), skills, openings.
- **~60 candidates** in the Agency 1 database with diverse skills, experience, notice periods, salaries, linkedin URLs.
- **~50 applications** spread across stages: sourcing, recruiter_shortlist, shared_with_client, client_shortlist, interview_scheduled, offered, joined, on_hold, closed (with rejection reasons).
- **~12 interviews** — past + upcoming, mix of providers (Google Meet, Teams, Zoom, Offline, Phone), with structured rounds (HR Screen, Technical, Managerial, Behavioral).
- **3 placements** (joined candidates) with offer/joining dates spread over last 90 days.
- **4 invoices** (2 paid, 1 sent, 1 draft) with line items tied to placements.
- **Activities** + **tasks** + **messages** + **documents** seeded so each portal section has content.

### Default Agency (admin@gmail.com)
Seed under `agency_id = ef14901d...`:
- **2 clients** (Helio Robotics, Coastline Capital) — light footprint to show super_admin / dual-agency view.
- **4 positions**, **15 candidates**, **10 applications**, **3 interviews**, **1 placement**, **1 invoice**.

### Cross-cutting
- **`client_members`**: add `client1@gmail.com` as owner of AI Tech.
- **`recruiter_login_events`**: backfill 7 days of logins for both agency users so the dashboard tile renders.
- All `created_at`/`updated_at` timestamps spread over the last 60 days for realistic activity timelines.

## Execution

Two tool calls only:
1. **`supabase--insert`** — one big SQL block: DELETE everything above + DELETE auth users (via `auth.admin.delete_user`-equivalent — actually `DELETE FROM auth.users WHERE email NOT IN (...)` cascades through profiles/roles via existing FKs).
2. **`supabase--insert`** — one big SQL block: INSERT all seed data using deterministic UUIDs so cross-references work.

No schema changes, no code changes, no migration needed.

## Out of scope
- No new tables or RLS edits.
- No UI/component changes.
- Hardcoded `src/lib/client-data.ts` / `mock-data.ts` (static demo fixtures) stay as-is — they're not used by the live portals which read from the DB.
