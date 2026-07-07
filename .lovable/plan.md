## Problem

Post-interview workflow dead-ends after the client hits "Select":

1. `recordInterviewDecision("select")` flips `applications.stage` to `offered`. Nothing else.
2. No UI ever creates a row in the `placements` table. `client.placements` and `billing` both read from `placements`, so both stay empty forever.
3. The client has no way to say "offer accepted / candidate joined" and the recruiter has no button to convert an offered application into a placement.

Result: candidate stuck in "Offered" limbo, no invoice trigger, no guarantee-window tracking.

## Fix — 3-step handoff

### Step 1 (client, right after Select)

In `client.interviews.tsx` `PastDecision`, when `stage === "offered"`, replace the static "Selected" pill with two actions:

- **Mark offer accepted / joined** → opens a small dialog to fill offer date, joining date, final CTC (optional notes). Submits `createClientPlacement` (new server fn).
- **Withdraw / not joining** → sets stage back to `client_rejected` with a reason note.

Also expose the same "Confirm joining" button on `client.positions.$positionId.tsx` for candidates whose stage is `offered` (so clients can find it from the role page too).

### Step 2 (server, `src/lib/interviews.functions.ts`)

Add `createClientPlacement` server fn:

- Input: `application_id`, `offer_date`, `joining_date`, `ctc_display?`, `ctc_inr?`, `notes?`
- Verifies caller is client team member for that position (via RLS-scoped read of `applications`)
- Uses `supabaseAdmin` to insert into `placements` (client role isn't in staff insert RLS — mirrors the existing `requestClientInterview` pattern) with the right `agency_id` stamped from the parent application
- Reads `client_billing_terms` to seed `guarantee_window_days` and `invoice_status = 'draft'`
- Updates the application stage → `closed`
- Marks the position as `closed` (only if openings are all filled — count offered/placed against `positions.openings`)
- Logs `activities` (kind: `offer`, `client_visible: true`) so the recruiter sees "Candidate joined — raise invoice" (the existing DB trigger `notify_agency_on_joining` already fires notifications)
- Returns the placement row

### Step 3 (recruiter safety net)

On the recruiter side (`interviews.$processId.tsx` or the pipeline card for `offered` applications), add a "Record placement" button that opens the same dialog and calls a staff-scoped `createPlacement` (already exists — just wire the button). This covers cases where the client confirms out-of-band.

Also add on `client.placements.tsx`: an inline "Pending placements" section listing `offered`-stage applications with no placement row yet, each with a "Confirm joining" button — so clients returning later can still finish the handoff.

### Files touched

- `src/lib/interviews.functions.ts` — new `createClientPlacement` server fn
- `src/routes/client.interviews.tsx` — replace static "Selected" pill with joining dialog
- `src/routes/client.positions.$positionId.tsx` — "Confirm joining" button on offered candidates
- `src/routes/client.placements.tsx` — "Pending placements" section
- `src/routes/interviews.$processId.tsx` — recruiter "Record placement" button on offered process
- New component: `src/components/confirm-joining-dialog.tsx` (shared by client + recruiter)

### No schema changes required

`placements` table already has `offer_date`, `joining_date`, `ctc_inr`, `ctc_display`, `guarantee_window_days`, `invoice_status`. The `notify_agency_on_joining` trigger already fires on `joining_date` set.

## Out of scope

- Actual invoice PDF generation (already handled by the billing module once `placements` rows exist)
- Editing/deleting placements post-creation (already covered by existing `updatePlacement`)
- Google Calendar cancellation of remaining interview rounds when marking closed (nice-to-have; say the word)
