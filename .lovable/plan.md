## Problem

Clients can schedule an interview without connecting Google Calendar. When they do, `provider = google_meet` is set but `syncGoogleMeet` silently no-ops (no token), so `meeting_link` stays `null`. Downstream every "Join" button is force-disabled (`!meeting_link && "opacity-50 pointer-events-none"`). Result: interview exists, no meeting link, no calendar invite emailed to candidate, no way to join — dead end.

Same problem on the recruiter side (`createInterview`), but the immediate complaint is the client flow.

## Fix

### 1. Gate the client scheduling dialog on Google connection

In `src/routes/client.positions.$positionId.tsx`:

- Query `getMyGoogleConnection` alongside existing queries.
- In the "Schedule interview" dialog, when the selected provider is `google_meet` / `microsoft_teams` / `zoom` (any virtual) AND `connected === false`:
  - Replace the submit button with a "Connect Google Calendar to continue" state
  - Inline-render the existing `<GoogleCalendarCard />` (or a compact variant) inside the dialog so they connect without leaving the flow
  - Only allow submit when `connected === true` OR provider is `on_site` / `phone`
- After OAuth returns (existing `postMessage` invalidates `google-connection`), the dialog auto-unlocks.

### 2. Surface connection status on the position page

Above the candidate list, show a small banner when Google is not connected:
"Connect Google Calendar to schedule video interviews and auto-send invites." with a Connect button (opens same OAuth flow).

### 3. Fix Join button UX (both `client.interviews.tsx` and `interviews.tsx`)

Right now: link is rendered but styled disabled when `meeting_link` is null — looks broken with no explanation.

Change to: when `meeting_link` is null AND provider is a virtual provider AND scheduled_at exists:
- Show a "Meeting link pending" pill instead of a dead Join button
- Add a small "Retry sync" action (calls `updateInterview` with same `scheduled_at` to re-trigger `syncGoogleMeet`) shown only when Google is connected
- When Google is NOT connected, the pill links to settings: "Connect Google Calendar to generate link"

For `on_site`, show location instead of Join. For `phone`, show phone label.

### 4. Backfill link on connect

When a client connects Google Calendar (after `getMyGoogleConnection` invalidation), add a lightweight server fn `resyncPendingClientInterviews` that finds their upcoming `google_meet` interviews without `meeting_link` and re-runs `syncGoogleMeet`. Trigger it once from `GoogleCalendarCard` on successful connect (or reuse an existing invalidation hook).

### Files touched

- `src/routes/client.positions.$positionId.tsx` — dialog gating + banner
- `src/routes/client.interviews.tsx` — Join button states
- `src/routes/interviews.tsx` — Join button states (recruiter view, same fix)
- `src/lib/interviews.functions.ts` — add `resyncPendingInterviews` server fn
- `src/components/google-calendar-card.tsx` — call resync on successful connect

No schema changes. No changes to `syncGoogleMeet` logic itself.

## Out of scope

- Microsoft Teams / Zoom OAuth (still no real integration — I'll keep those provider options but gate the same way; without Google, only `on_site` / `phone` are actually usable). If you want, I can hide Teams/Zoom from the picker entirely until we integrate them — say the word.
