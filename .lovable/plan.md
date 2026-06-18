## Goal

Wipe existing operational data and seed a fresh, light demo dataset so every screen has something to test against. Keep all logins, agencies (Default Agency, Agency 1), clients (Acme Corp, AI Tech), and roles untouched.

Most volume lands on **Default Agency / Acme Corp** (your primary test account); Agency 1 / AI Tech gets a smaller secondary set so you can verify multi-tenant isolation.

## What gets cleared

Operational tables only — in dependency order:

```
messages, message_threads, notifications, activities, tasks,
documents, invoice_line_items, invoices, placements,
position_sourced_matches, position_sourcing_runs, sourced_candidates,
interviews, applications, candidates, positions, client_billing_terms
```

Untouched: `profiles`, `user_roles`, `agencies`, `agency_members`, `clients`, `client_members`, `role_permissions`, `client_custom_roles`, `interview_round_templates`, `scout_source_settings`.

## What gets seeded

**Default Agency → Acme Corp (primary)**
- 1 billing terms row (15% of CTC, GST 18, payment 30 days, monthly cycle).
- 5 positions covering every status: 1 `open`, 2 `in_progress`, 1 `interviews`, 1 `closed`. Mix of priorities, locations, salary bands, skill stacks. Posted dates spread over the last 60 days.
- ~15 candidates with realistic Indian names, roles, companies, skills, LinkedIn URLs; sources spread across `manual`, `scout`, `referral`, `database`, `inbound`.
- ~12 applications spread across every stage in `application_stage` so the pipeline kanban shows cards in each column.
- 5 interviews: 2 `confirmed` upcoming (next 7 days), 1 `pending_confirmation`, 1 `completed`, 1 `reschedule_requested`. Mix of `hr_screen`, `technical`, `hiring_manager`, `panel`. Providers vary (google_meet, zoom, on_site).
- 2 placements (for the `closed` position) with joining dates in the recent past — these trigger the join → invoice flow.
- 2 invoices: 1 `sent`, 1 `paid`, each with line items tied to a placement.
- 6 tasks across `Pending`, `Ongoing`, `Interview Pending`, `Closed` with mixed SLA (`ok`, `warning`, `breach`) and due dates.
- 10 activities across kinds (`submission`, `shortlist`, `interview_scheduled`, `offer`, `closure`, `message`, `document`, `stage_change`).
- 8 notifications for the recruiter & admin users (interview_reminder, invoice_due, invoice_overdue, task_sla_breach, system) — mix of read/unread.
- 1 message thread with the Acme client user + 4 messages (alternating staff/client).
- 4 documents (1 JD, 1 offer, 2 resumes) — metadata only, no real files.
- ~12 sourced LinkedIn candidates (mix of `open_to_work=true`/`false`, none `is_hiring=true`) with 1 sourcing run (`succeeded`) and 6 position_sourced_matches linked to an open position.

**Agency 1 → AI Tech (secondary, lighter)**
- 1 billing terms row (8.33% per_joining model, to test the other fee model).
- 2 positions (1 `open`, 1 `interviews`).
- 5 candidates, 4 applications across early/mid stages.
- 1 upcoming interview, 1 placement + 1 draft invoice.
- 2 tasks, 4 activities, 3 notifications for the agency1 admin.
- 1 message thread + 2 messages.
- 4 sourced candidates, 1 succeeded run, 2 matches.

## Linking to your existing users

- Acme client user (`client@gmail.com`) — receives client-side messages, notifications, owns the Acme client row already.
- Recruiter (`recruit@gmail.com`) — assigned as `assigned_recruiter_id` on Acme positions, receives recruiter notifications/tasks.
- Super admin (`admin@gmail.com`) — receives admin notifications.
- Agency1 admin (`agency1@gmail.com`) — assigned recruiter on AI Tech positions, receives notifications.
- AI Tech client user (`client1@gmail.com`) — receives client-side messages on AI Tech thread.

`created_by` / `actor_id` / `triggered_by` are set to the relevant recruiter or admin so RLS-scoped queries return rows.

## Delivery

A single migration that:
1. `DELETE`s from the operational tables listed above in dependency order.
2. `INSERT`s the new dataset using deterministic `gen_random_uuid()` per row and `now() - interval '…'` for varied timestamps.

After the migration runs you should be able to walk every route (`/dashboard`, `/positions`, `/pipeline`, `/interviews`, `/tasks`, `/activity`, `/billing`, `/messages`, `/scout`, `/database`, `/closed`, `/ongoing`, `/pending`, and the client portal `/client/*`) and see populated content for both agencies.

## Out of scope

- Real file uploads (documents are metadata-only — `storage_path` will be a placeholder string; the file won't actually open).
- New user accounts.
- Schema changes.
- Settings tables (`role_permissions`, `client_custom_roles`, `client_role_permissions`, `interview_round_templates`, `scout_source_settings`) — keep your current configuration.