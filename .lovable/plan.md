
## Goal

Reset the app to a clean slate (keeping your existing auth accounts), then script the full workflow end-to-end with Playwright and flag any bug or missing piece I hit along the way.

## Step 1 — Wipe app data (keep auth users)

Single migration truncating every domain table with `RESTART IDENTITY CASCADE`, in dependency order:

- Activity / messaging: `activities`, `messages`, `message_threads`, `notifications`, `notification_dedup`, `tasks`, `support_tickets`
- Billing: `invoice_line_items`, `invoices`, `client_billing_terms`
- Pipeline: `placements`, `interviews`, `applications`, `job_applications`, `job_post_channels`, `job_posts`
- Sourcing: `position_sourced_matches`, `position_sourcing_runs`, `sourced_candidates`, `candidates`
- Positions & clients: `positions`, `client_role_permissions`, `client_custom_roles`, `client_members`, `clients`
- Agency scaffolding: `interview_round_templates`, `scout_source_settings`, `google_calendar_connections`, `recruiter_login_events`, `agency_members`, `agencies`
- Documents/storage rows: `documents` (I'll leave the two storage buckets alone; you can clear objects manually if needed)

Preserved: `auth.users`, `profiles`, `user_roles`, `role_permissions` — so superadmin/admin/recruiter/client accounts still work.

I'll snapshot row counts before/after so you can see exactly what was cleared.

## Step 2 — Script the workflow with Playwright

One Playwright script per stage, each taking screenshots and reading DB state to verify. I'll need you to tell me (or I'll pick from `user_roles`) the emails/passwords for a super_admin, plus two throwaway client emails and 2–3 recruiter emails to use during the run. If passwords aren't known, I'll reset them via the admin API before starting.

Stages:

1. **Super admin → 2 agencies.** Log in as super_admin, create Agency A and Agency B through the UI. Verify `agencies` rows + super_admin visibility of both.
2. **Agency admins → team members.** For each agency, sign in as its admin, invite / add 2 recruiters (mix of `recruiter`, `lead_recruiter`, `senior_recruiter`). Verify `agency_members` + `user_roles` and that each recruiter can log into `/me` (regression check for the lead/senior gate fix).
3. **Board 2 clients & assign recruiters.** From the agency admin, onboard Client 1 → Agency A, Client 2 → Agency B, add billing terms, and assign 1–2 recruiters to each via `client_members` / assignment UI.
4. **Client → requirements.** Log in as each client, create 1–2 open positions with role, count, JD.
5. **Recruiter workflow per position.** For each assigned recruiter:
   - Scout/source candidates (Scout page) → add manual candidates as a fallback so the pipeline has data.
   - Move candidates through stages, submit shortlist to the client.
6. **Client shortlist + interview scheduling.** As the client: review submitted candidates, shortlist a few, schedule an interview. **Google Meet/Calendar is skipped per your choice**; I'll assert the `interviews` row is created and the candidate notification email is enqueued in `email_send_log` / `transactional_emails` queue (and check `notifications` for internal alerts).
7. **Post-interview flow.** As the client, mark interview outcome → advance candidate to next round / reject. Repeat until one candidate is marked "joined" so the `notify_agency_on_joining` trigger fires and an invoice notification lands for the agency.
8. **Billing tail.** Verify the agency admin sees the "raise invoice" notification and can generate an invoice with line items.

## Step 3 — Coverage sweep for anything not mentioned

While running the above I'll also touch and report on:

- Tasks / SLA on the new admin dashboard populate correctly
- Recruiter login-time tracking (`recruiter_login_events`) records real logins
- Client-portal messaging thread between client ↔ recruiter
- Documents upload on a candidate (bucket ACLs)
- Notifications feed for all four personas
- Interview reminder / calendar-less path doesn't crash

## Step 4 — Report

A single write-up per stage with: screenshot, DB assertion result, and any bug found. Bugs get logged, not silently patched — I'll list them and you decide what to fix in the next round.

## What I need from you before running

1. Confirm the wipe list above (especially that clearing `documents`, `invoices`, `google_calendar_connections`, and `recruiter_login_events` is fine).
2. Either the passwords for one super_admin + one agency admin per agency + 2 client accounts + 3 recruiter accounts, **or** permission for me to reset them via the admin API for the duration of the test.
3. Confirm skipping Google Meet is still fine (I'll only assert the interview record + candidate email got enqueued).

Once you approve, I'll run the migration first, then execute the Playwright stages one at a time and pause if something is clearly broken so you can decide fix-now vs. keep-going.
