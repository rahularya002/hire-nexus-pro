
# Client portal — gap-coverage plan

Today the client portal has only 4 pages (Overview, Positions, Upload JD, Documents). The admin portal exposes a much richer operational view. This plan brings the client portal to parity on visibility — without giving them recruiter-only surfaces (Tasks, Candidate DB, Recruiter Roster admin).

## What changes in the sidebar

Current client nav: Overview · Positions · Upload JD · Documents

New client nav (in order):

```text
Overview
My Requirements        ← upgraded "Positions" with end-to-end progress per JD
Pipeline               ← NEW
Interviews             ← NEW
Placements             ← NEW
Reports                ← NEW
Activity               ← NEW
Account Team           ← NEW
Upload JD
Documents
```

A bell icon in the topbar opens a Notifications panel (NEW), reading the same activity stream.

## Section-by-section

### 1. My Requirements (upgrade of `/client/positions`)
Each JD the client uploads is "sent to admin" and becomes an Open Requirement on the agency side. The client needs to see end-to-end progress, not just a status pill.

Per row:
- Title, location, openings, posted date, current status
- Sent-to-agency timestamp + assigned recruiter (from Account Team)
- 6-step progress bar: **Received → Sourcing → Profiles shared → Client review → Interviews → Offer/Joined**, with the active step highlighted and counts under each (e.g. "12 sourced · 5 shared · 2 in interview")
- TAT (days since sent) and SLA chip (green/amber/red)
- Inline actions: View detail · Pause · Close

Filters: All / Active / On hold / Closed.

### 2. Pipeline (NEW) — `/client/pipeline`
Kanban across all the client's open requirements, mirroring admin `/pipeline`. Columns: **Shared → Shortlisted → Interview → Offered → Joined → Rejected**. Each card = candidate with role, position, recruiter, last activity. Read-only drag (status changes require admin), but click-through to candidate.

### 3. Interviews (NEW) — `/client/interviews`
Mirror of admin `/interviews`. Tabs: **Today · Upcoming · Past**. Each row: candidate, position, panel, mode (Meet/Zoom/On-site), join link, reschedule / propose new slot. Past tab shows feedback the client owes.

### 4. Placements (NEW) — `/client/placements`
Mirror of admin `/closed`. Joined candidates with: offer date, joining date, CTC, replacement-window countdown (e.g. "Guarantee period — 47/90 days"), invoice status placeholder. Useful for the client to see hiring history with the agency.

### 5. Reports (NEW) — `/client/reports`
Charts the admin dashboard already has, scoped to this client:
- Funnel conversion (Sourced → Shared → Shortlist → Interview → Offer → Joined)
- TAT per requirement
- Source-of-hire mix
- Monthly hires (last 6 months)
- Recruiter response time

### 6. Activity & Notifications (NEW) — `/client/activity` + bell panel
Reverse-chronological stream of events on this account: new profiles shared, slot proposed, slot confirmed, offer rolled out, document received, requirement closed. Bell icon shows unread count and a 6-item dropdown panel.

### 7. Account Team (NEW) — `/client/team`
Cards for each recruiter staffed on the account: name, role, response-time average, requirements they own, contact (email / WhatsApp / call). Replaces the static "Aarav Reddy" footer card.

### 8. Per-position Messages thread (NEW)
The "Message recruiter" button on `/client/positions/$positionId` currently does nothing. Wire it to a Messages tab on the position detail with a simple thread (sender, timestamp, body, attachments). Same component reused for read on the Activity page.

## Explicitly NOT building
- **Tasks** — recruiter-side only, per your direction.
- **Candidate DB / AI Scout** — internal recruiter tools, stay admin-only.
- **Admin Recruiter Roster** — the client sees only their own Account Team subset.

## Implementation phases

Phase 1 — visibility upgrades (high signal, low risk)
- My Requirements progress bar
- Activity page + bell panel
- Account Team page

Phase 2 — operational mirrors
- Interviews page
- Pipeline kanban
- Placements page

Phase 3 — analytics & messaging
- Reports page
- Per-position Messages thread

## Technical notes
- All new pages live under `src/routes/client.*.tsx` and use `ClientShell`.
- Sidebar updated in `src/components/client-shell.tsx` (new icons from `lucide-react`).
- Mock data extended in `src/lib/client-data.ts` with: requirement progress steps, recruiter assignments, activity events, placements, message threads. No backend yet — same approach as the rest of the app.
- Charts use the existing `recharts` setup from the admin dashboard for consistency.
- Notifications panel reuses the existing `DropdownMenu` primitive.
- All data is scoped to `clientCompany` so the client sees only their own slice.

After approval I'll start with Phase 1 and pause for review before Phase 2.
