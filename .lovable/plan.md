## Goal

Wire the AI screener into the real workflow: recruiter-triggered calls from shortlisted candidates on a position and from scout results, with a graceful path when we don't have a phone number yet (which is the norm for LinkedIn-scouted profiles). Ship browser-based screening now, and leave a clean seam to plug real outbound dialing later.

## Behavior

### Trigger points
- **Position pipeline → Shortlisted candidates** (`client.positions.$positionId.tsx` + agency `positions.$positionId.tsx`): each shortlisted row gets a "Screen" action.
- **Scout results after shortlist**: on `client.scout.tsx`, once a sourced candidate is shortlisted onto a position, they appear in that position's shortlist with the same "Screen" action. No screening button on raw scout rows (no candidate record yet).

### Phone-number gating
- In table rows: if `candidate.phone` is missing → button is **disabled** with tooltip "Add a phone number to enable AI screening."
- In candidate detail / edit dialog: an inline "Add phone & screen" prompt saves the number to `candidates.phone` and immediately opens the call dialog.

### Call modes (both, side-by-side)
1. **Test in browser** — the existing WebRTC flow. Uses the recruiter's mic; no telephony cost. Labelled "Rehearse in browser". Available regardless of phone number.
2. **Call candidate** — outbound phone call. Disabled today with tooltip "Outbound calling not configured. Set up Twilio number in Settings." A single feature flag (`OUTBOUND_CALLING_ENABLED`, off by default) flips it on once the Twilio/ElevenLabs number is provisioned. Implementation lands in a follow-up plan — this plan only scaffolds the UI + server-fn stub returning "not configured".

### Result capture (all four)
After a call ends (browser or outbound), we:
1. Fetch the ElevenLabs `conversation` object (`getConversationDebug` already exists; extend to return `transcript` + `analysis.summary`).
2. Persist to a new `candidate_screening_calls` row: candidate_id, position_id, agency_id, elevenlabs_conversation_id, mode (`browser` | `phone`), duration_sec, transcript (jsonb), summary (text), agent_verdict (`pass` | `fail` | `unclear` | null), created_by, created_at.
3. If `agent_verdict = 'pass'`, advance the application from `shortlisted` → `screened` (new stage value).
4. Emit an in-app notification to the recruiter (position owner + assignees) with the summary snippet.

## Data model

New table `public.candidate_screening_calls` (migration):
- Standard agency scoping via `set_agency_id_default` trigger.
- FKs to `candidates`, `positions`, `auth.users`.
- RLS: agency members read/insert; client team read for their own client's positions.
- Full GRANT block per project convention.

Add nullable `phone` to `candidates` if missing (verify with schema read first).
Extend `applications.stage` enum (or existing status column) with `screened` if not already there — verify first, add only if missing.

## Files to change

- `supabase` migration: create `candidate_screening_calls`, indexes, RLS, GRANTs; conditionally add `screened` stage.
- `src/lib/ai-screener.functions.ts`:
  - `startCandidateScreening({ candidateId, positionId, mode })` — validates phone for `phone` mode, returns WebRTC token + dynamic variables built from the real candidate/position/client.
  - `recordScreeningResult({ conversationId, candidateId, positionId, mode })` — fetches transcript from ElevenLabs, inserts row, advances stage on pass, sends notification.
  - `placeOutboundCall(...)` — stub returning `{ ok: false, reason: 'not_configured' }` behind `OUTBOUND_CALLING_ENABLED`.
- `src/components/ai-screener-card.tsx`: extract the call surface into a reusable `ScreeningCallDialog` that accepts `{ candidate, position, mode }` and reuses the existing ConversationProvider + connect flow. Keep the current "Test call" button on the position config page using the same dialog with `mode='browser'` and dummy variables.
- `src/components/candidate-screen-button.tsx` (new): the disabled-when-no-phone button + tooltip, opens the dialog. Two-button popover: "Rehearse in browser" / "Call candidate".
- `src/routes/client.positions.$positionId.tsx` and `src/routes/positions.$positionId.tsx`: render `<CandidateScreenButton />` in each shortlisted row.
- `src/components/edit-candidate-dialog.tsx`: inline "Add phone and screen now" affordance when phone is empty.
- `src/routes/database.tsx`: same button in the CV/actions column for shortlisted-status candidates.

No changes to `client.scout.tsx` beyond ensuring the existing shortlist action lands the candidate where the new button appears.

## Out of scope (follow-up)

- Real Twilio/ElevenLabs outbound provisioning, number purchase, and call-status webhook.
- Bulk queued calling.
- Auto-fetching phone numbers from Naukri/other actors — belongs with the sourcing-actor work, not the screener.

## Verification

After build: open a position with a shortlisted candidate → button disabled → open candidate → add phone → "Rehearse in browser" launches the ElevenLabs session with real `candidate_name`/`job_title`/`company_name`; on hang-up, transcript + summary land on the candidate and the stage flips to `screened`. Confirm "Call candidate" shows the disabled-with-reason state.
