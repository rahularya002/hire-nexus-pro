## Goal
Give the agency/recruiter `/interviews` route the same interface clients get at `/client/interviews` — mini calendar, "Next interview" card, Today/Upcoming/Past tabs, and a clean row list with Join + Reschedule actions.

## Changes

**`src/routes/interviews.tsx`** — replace the current "Today's interviews + Active interview processes" layout with the client-parity layout:
- Header ("Interviews") + subtitle.
- Left: mini `Calendar` with dots on days that have interviews; clicking a day filters rows to that date; "Clear date filter" button.
- Right: "Next interview" card showing next upcoming row, with `Join` and a "View role" link (points to the agency route `/positions/$positionId` instead of `/client/positions/$positionId`).
- Tab strip: Today / Upcoming / Past with counts.
- Row list: time block, avatar, candidate name, position link (agency route), round/conductor line, interviewer + provider meta, `Reschedule` + `JoinCell` actions.
- Reuse `RescheduleInterviewDialog` (invalidate keys: `staff-interviews`, `client-interviews`, `interviews/today`).
- `JoinCell` identical to client's (on-site chip, phone chip, Join button, "Meeting link pending" fallback).

**Past-row behavior (agency read-only)**
Clients decide select/reject/next-round; the agency shouldn't. For `tab === "past"` on the agency page, show a read-only status pill derived from `application.stage`:
- `closed` → "Joined"
- `offered` → "Selected — awaiting join"
- `client_rejected` → "Rejected"
- otherwise → "Awaiting client decision"

No new `PastDecision` buttons for agency. `ConfirmJoiningDialog` stays client-only.

**Keep**
- The multi-round "Active interview processes" pipeline view is useful — keep it below the new list as a collapsed/secondary section, or drop it entirely to match the client's page exactly.

## Question for you
Do you want the existing "Active interview processes" pipeline cards (which link into `/interviews/$processId`) kept below the new client-style list, or removed so the agency page is a 1:1 match with the client page? Default in the plan: **remove** for a clean 1:1 match; the process detail is still reachable from candidate/position pages.

## Files touched
- `src/routes/interviews.tsx` (rewrite)

No server-fn or schema changes; `listInterviews({ scope: "all" })` already returns everything the agency needs.