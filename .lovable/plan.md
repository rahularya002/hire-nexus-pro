# Full webapp QA sweep

Goal: drive the live app as each persona, catch broken flows / dead links / RLS gaps / console errors, and produce a prioritized fix list. No code changes in this pass — fixes happen after you approve the findings.

## How I'll test

I'll use Playwright against the running preview, signed in as each seeded account, plus Supabase reads and the DB linter for backend checks. Screenshots + console/network logs captured per step.

Accounts:
- `admin@gmail.com` (agency admin)
- `agency1@gmail.com` (recruiter on Default agency)
- `client1@gmail.com` (client portal)

## Scope per persona

**Agency admin**
- Dashboard loads, KPIs populate, today's interviews + recruiter logins panel render
- Sidebar: Tasks, Messages, Open Requirements, Ongoing, Interviews, Closed, Sourcing (Scouting + Posting), Candidate DB, Clients, Recruiter Roster, Billing
- Open one client → assign recruiter, edit position, view agencies engaged
- Open one position → pipeline by stage, edit candidate, schedule interview (with Google Meet path), reject/shortlist/hold buttons gated correctly
- Roster drawer: login history, assigned clients, activity timeline
- Billing: invoice list + detail

**Recruiter (agency1)**
- Sidebar shows only: My Desk, Tasks, Open Requirements, My Clients, Interviews, Candidate DB, Sourcing, My Activity (no Pipeline, no Recruiter Activity, no Recruiter Roster)
- Data scoping: only assigned clients/positions visible
- Add candidate with skills/phone/linkedin/salary, edit from DB
- Scouting shows internal-DB matches with correct status labels
- Reject button hidden once candidate is `shared_with_client`+

**Client (client1)**
- Sidebar groups: Overview, Hiring Pipeline, Finance, Team, Resources (no Pipeline link)
- Dashboard 5-stage funnel + Open positions KPI
- Positions list: per-row funnel, sourcing hidden
- Position detail: AI Match label, Schedule interview only after client shortlist, Put on hold/Resume, edit candidate, edit position
- Schedule interview dialog: dynamic rounds (add/remove, types), interviewer dropdown from client team, meeting mode incl. Offline
- Interviews: calendar + next-interview card
- Activity: position filter, timeline, stat tiles
- Settings: Google Calendar connect card present
- My Team: read-only, Message button works

**Cross-cutting**
- Auth redirects (login/pending/portal routing) for each role
- Console errors and failed network calls on every visited page
- Supabase linter pass + spot-check RLS on `interviews`, `positions`, `applications`, `clients`, `client_members`
- Seed-data sanity: counts match, today's interviews still set for today, no orphaned FKs
- 404/notFound boundaries on a bogus `/positions/bogus-id` and `/client/positions/bogus-id`
- Mobile viewport spot-check on dashboard + position detail

## Deliverable

A single report grouped as:
1. **Broken** — blocks user flow (with screenshot + repro)
2. **Buggy** — works but wrong (label, gating, stale data)
3. **Polish** — minor UX/empty-state/copy
4. **Backend** — RLS / linter / data integrity

Then you pick what to fix and I implement in build mode.

## Out of scope

- No code edits this turn
- No reseed / data mutation beyond read queries
- External OAuth round-trip to Google (will verify UI + token-exchange code path only, not a real Google login)
