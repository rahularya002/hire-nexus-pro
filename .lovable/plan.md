Right now scheduling a virtual interview (Meet / Teams / Zoom) is hard-blocked until the client connects Google, and the join column nags "Connect Google to generate link". We'll drop the hard gate and let clients (and recruiters) either connect Google for auto Meet links **or** just paste a meeting link manually — or leave it blank and add it later.

## Changes

### 1. Schedule dialog — `src/routes/client.positions.$positionId.tsx`
- Remove the `needsGoogle` block that renders `<GoogleCalendarCard>` inline and disables the submit button.
- Add a new optional field **"Meeting link (optional)"** visible when provider is `google_meet` / `microsoft_teams` / `zoom`. Placeholder: `https://meet.google.com/... or paste a Teams/Zoom link`.
- Update the helper text under provider:
  - `google_meet`: "Paste a Meet link, or leave blank — if you've connected Google Calendar (Settings), we'll auto-generate one. Otherwise you can add the link later."
  - `teams` / `zoom`: "Paste the meeting link, or add it later after the recruiter confirms."
- Keep a small "Connect Google Calendar" inline hint (link to `/client/settings`) when virtual + not connected + link field empty — informational only, never blocking.
- Pass `meeting_link` through to `onSubmit` and to `requestClientInterview`.

### 2. Server fn — `src/lib/interviews.functions.ts`
- Extend `requestClientInterview` input validator with `meeting_link: z.string().url().max(500).optional().nullable()`.
- On round 1 insert, stamp `meeting_link` if provided.
- Leave existing `syncGoogleMeet` behavior intact: it only runs when the caller has a Google connection, and it already no-ops if a link is already present (guard added if missing).

### 3. Join cells — `src/routes/client.interviews.tsx` and `src/routes/interviews.tsx`
- Replace the "Connect Google to generate link" warning pill with the neutral "Meeting link pending" chip that both branches already have. Optionally add a subtle "Add link" affordance that opens the existing reschedule/edit dialog so anyone can paste one in.

### 4. Settings copy — `src/routes/client.settings.tsx` / `GoogleCalendarCard`
- Reword the description to make it clear the connection is optional and only powers auto Meet link + auto invites: "Optional — connect Google so interviews you schedule auto-generate a Meet link and email invites. You can also skip this and paste meeting links manually."

### 5. (Recruiter side) `ScheduleInterviewDialog` / `RescheduleInterviewDialog`
- If a `meeting_link` input already exists in the recruiter-side edit dialog, no change. If not, add the same optional field so recruiters can paste a link when they don't use Google.

## Out of scope
- No DB migration (the `meeting_link` column already exists on `interviews`).
- No change to the OAuth flow itself or `syncGoogleMeet`; connecting Google remains a one-click convenience.
- No changes to on-site / phone providers.

## Files touched
- `src/routes/client.positions.$positionId.tsx`
- `src/lib/interviews.functions.ts`
- `src/routes/client.interviews.tsx`
- `src/routes/interviews.tsx`
- `src/routes/client.settings.tsx` (copy only)
- `src/components/google-calendar-card.tsx` (copy only)
- `src/components/reschedule-interview-dialog.tsx` (add optional link field if missing)
