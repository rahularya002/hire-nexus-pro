# Plan — Agency & Client UI polish + Joining-triggered billing notification

Scope: UI/presentation changes only (no new roles, no workflow rewrites). Plus one backend hook: when a placement gets a `joining_date`, notify the agency owner/recruiter to raise the invoice. **Out of scope** (per your call): Activity, My Team, WhatsApp/SMS.

---

## 1. Agency side — UI clarifications

### 1a. Dashboard label + scoping
- Add a clear header on the agency dashboard ("Recruiter Dashboard" for recruiter role, "Manager Dashboard" for owner/manager) using existing role from `user_roles`.
- "Active Clients" tile for recruiters → count only clients where they're the assigned recruiter on at least one position (filter via `positions.recruiter_id = auth.uid()`). Managers keep the agency-wide count.
- "Open Positions" tile detail drawer: replace the "Assign recruiter" CTA with a read-only panel showing **company name, JD link/download, title, location, experience, CTC band, JD summary**. Keep "Assign recruiter" as a small secondary action visible only to managers.

### 1b. Position detail page
- Reorder the right rail so JD + company info are above the recruiter-assignment block.
- Add a "View JD" button that opens the uploaded JD doc from `documents` (already stored).

### 1c. Candidate database — history tab
- On each candidate profile, add a **History** tab listing every client they were shared with: client name, position, current stage (shortlisted/rejected/etc.), and rejection reason if present. Pure read from `applications` joined to `positions`/`clients`.

---

## 2. Client side — UI clarifications

### 2a. Upload JD helper
- Add a small "How to format for best auto-fill" expandable hint above the upload zone with 4–5 bullets (clear title, responsibilities section, must-have skills, experience range, location). No logic change.

### 2b. My Requirements → Position detail
- Under each candidate card show a compact meta row: **Current Org · Experience · Salary · Location · Match %**. All fields exist on `candidates` / `applications.match_score`.
- Replace "Message on LinkedIn" with **"View LinkedIn profile"** → opens `candidates.linkedin_url` in a new tab.

### 2c. Shortlist & Schedule Interview actions
- "Shortlist" → confirm toast + flip `applications.stage` to `client_shortlist`. Button switches to a green "Shortlisted" pill afterward.
- "Schedule Interview" → opens a modal (reuse existing interview scheduling dialog) with interviewer picker + date/time. Writes to `interviews` and flips stage to `interview_scheduled`.

### 2d. Pipeline rework
- Pipeline landing page = list of the client's open positions (title, # candidates, # in interview, # offered). Click → drills into the current per-candidate kanban for that position.

### 2e. Dummy data for Reports / Invoices / Placements
- Seed a small set of demo rows (3–5 each) scoped to the demo client so these pages aren't empty. Will be inserted via a data-only insert (not a migration).

---

## 3. Billing — notify agency on joining

This replaces the manual "raise invoice" trigger.

- Add a trigger on `public.placements`: when `joining_date` transitions from NULL → a date, insert a notification for the agency owner(s) of that client's agency with type `invoice_due`, payload `{ placement_id, candidate_name, client_name, joining_date, suggested_fee_inr }`.
- The existing notification bell will pick it up automatically.
- On the agency Billing page, add an **"Action needed"** strip at the top listing these pending joinings with a one-click **"Generate invoice"** button → calls existing `generateInvoiceForClient` server fn.
- No auto-invoice creation — agency confirms.

---

## Files touched

**Agency UI**: `src/routes/dashboard.tsx`, `src/routes/positions.$positionId.tsx`, `src/routes/database.tsx` (+ candidate detail), `src/components/app-shell.tsx` (dashboard header).

**Client UI**: `src/routes/client.upload.tsx`, `src/routes/client.positions.$positionId.tsx`, `src/routes/client.pipeline.tsx`, `src/components/scout-results.tsx` (LinkedIn link).

**Billing**: new DB trigger via migration, `src/routes/billing.index.tsx` (action strip), `src/lib/billing.functions.ts` (list pending joinings server fn).

**Dummy data**: insert tool call seeding `placements`, `invoices`, applications for the demo client.

---

## Out of scope (confirmed)
- Activity page, My Team page — leave as-is.
- WhatsApp/SMS interview reminders — defer.
- No new roles or permission model changes; only role-aware UI tweaks using existing `user_roles`.

Approve and I'll implement in this order: (1) billing trigger + notification strip, (2) agency UI tweaks, (3) client UI tweaks, (4) dummy data.
