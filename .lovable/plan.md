
# Minimal agency admin dashboard

Strip the dashboard down to the five sections you named. Everything else (daily digest tiles, KPI cockpit row, quiet clients card, activity feed, recruiter-logins panel, "who works with whom" card, etc.) gets removed from the admin view.

## Final layout (top → bottom)

```text
┌─────────────────────────────────────────────────────────┐
│ 1. Clients          │ 2. Employees                      │
│    active / inactive│    name · login time today        │
├─────────────────────┴───────────────────────────────────┤
│ 3. Interviews  ── Today | Upcoming (next 7d) tabs       │
├─────────────────────────────────────────────────────────┤
│ 4. Open positions  ── client · recruiter · stage counts │
├─────────────────────────────────────────────────────────┤
│ 5. Tasks           ── open tasks, grouped by priority   │
└─────────────────────────────────────────────────────────┘
```

### 1. Clients
Compact list. Each row: client name, chip = **Active** (activity in last 14 days) or **Inactive** (older / never). Count in header ("12 clients · 3 inactive"). Click → `/clients/$clientId`.

### 2. Employees
Compact list. Each row: avatar + name, role, and today's first login time (or "Not signed in"). Small dot for currently-online status. Click → opens the roster drawer in `/team`.

### 3. Interviews
Single card with two pills: **Today** (default) / **Upcoming 7d**. Rows: time · candidate · kind · client. Empty state per tab.

### 4. My open positions
Table/list of open positions the agency is running: title · client chip · assigned recruiter chip · candidate count. Click → `/positions/$positionId`.

### 5. Tasks
Open tasks assigned to me or my team, grouped by priority (High / Normal / Low), with due-date badge. Click → `/tasks`.

## What gets removed from admin view
- Daily digest bar (4 tiles)
- Cockpit KPI row (Requirements / Active clients / SLA)
- Interview streak, no-show, response-time cards
- Recruiter logins today standalone card
- Team Pulse (added last turn) — its login time gets folded into section 2
- Quiet clients / SLA at risk cards — inactivity now surfaces as a chip in section 1
- Activity stream feed
- "Who's working with whom" card — the recruiter chip now appears in section 4

Client and recruiter dashboards stay unchanged.

## Technical notes
- Edit `src/routes/dashboard.tsx`: for `isAdmin`, replace the current JSX with the 5 sections. Keep the existing loaders/queries we can reuse (`listClients`, `listInterviews`, `getTeamMembers`, `listTodayRecruiterLogins`, `listPositions`, `listTasks`) and drop unused ones from the admin branch.
- Delete the helper components no longer used by admin (`Cockpit`, `TeamPulse`, `ClientsByRecruiterCard`, digest builder, activity feed) or keep them behind non-admin branches if still used elsewhere in the file — a quick pass will confirm.
- No schema changes. No changes to recruiter or client dashboards.
