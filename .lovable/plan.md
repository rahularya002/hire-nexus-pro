# Google Meet + Calendar Integration

Each recruiter connects their own Google account. When they schedule an interview, we create a Google Calendar event with a Meet link and email invites to the candidate and any listed interviewers.

## What you need to do (one-time setup)

1. **Create a Google Cloud OAuth app** at https://console.cloud.google.com
   - Enable **Google Calendar API**
   - OAuth consent screen: External, add scopes `.../auth/calendar.events` and `.../auth/userinfo.email`
   - Create **OAuth Client ID** (Web application)
   - Add Authorized redirect URI: `https://hire.enbquantum.com/api/public/google-oauth/callback` (and the lovable.app preview URL)
   - Copy **Client ID** and **Client Secret**

2. Paste those two values into Lovable when prompted (stored as secrets `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`).

That's it on your side. After that, each recruiter clicks "Connect Google Calendar" in Settings once.

## What I'll build

### 1. Database
- New table `google_calendar_connections` (per user): `user_id`, `google_email`, `access_token`, `refresh_token`, `expires_at`, `scopes`. RLS so each user reads/writes only their own row; service role for token refresh.

### 2. OAuth flow (per-recruiter)
- `POST /api/google-oauth/start` server fn → returns Google consent URL with state token.
- `GET /api/public/google-oauth/callback` server route → exchanges code for tokens, stores them in `google_calendar_connections`, closes popup.
- Background refresh helper that swaps `refresh_token` for a fresh `access_token` when expired.

### 3. Settings UI
- New "Integrations" card in `src/routes/settings.tsx` showing Google Calendar connect/disconnect state with the connected Google email.

### 4. Interview scheduling hook
- New server fn `createGoogleMeetEvent({ interviewId })`:
  - Reads the interview (candidate email, interviewer, scheduled_at, duration, title, notes).
  - Uses the **logged-in recruiter's** stored Google token.
  - Calls `POST https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all` with `conferenceData.createRequest` to mint a Meet link.
  - Attendees: candidate email + any interviewer emails. Google sends the invite emails automatically (`sendUpdates=all`).
  - Saves the returned Meet URL into `interviews.meeting_link` and the event id into a new `interviews.external_event_id` column.
- Triggered automatically inside `createInterview` / `updateInterview` (when provider is `google_meet` and `scheduled_at` is set), and when `scheduled_at` changes the event is patched (reschedule) and re-notifies attendees.
- If the recruiter hasn't connected Google, the interview still saves but the UI shows a "Connect Google Calendar to auto-generate Meet link" hint and a manual link input remains available (current behavior).

### 5. UI polish on the interview round card
- Show connection status badge ("Auto-generated via {google_email}") next to the meeting link when provider is google_meet.
- Show a small "Reconnect Google" link if the token refresh fails.

## What this does NOT do

- Does not create events on the **candidate's** calendar (candidates get the invite by email; they accept it from their inbox like any meeting).
- Does not sync availability / free-busy.
- Does not work for clients conducting the round — only recruiter-conducted rounds auto-generate Meet links from the recruiter's account.

## Confirm to proceed

Reply "go" and I'll create the database migration, then ask you for the Google Client ID + Secret once the Cloud OAuth app is ready.
