## Goal

1. When a client rejects a candidate, the recruiter/admin sees a clear "needs attention" signal on that requirement, with a one-click "Replace" button that opens AI Talent Scout pre-loaded with the JD.
2. Fix the client-side **Reject**, **Shortlist**, and **Schedule interview** buttons so they actually transition state and surface to the admin.

## 1. New "client_rejected" stage

Today, the client's "Reject" button maps to the generic `closed` stage — which also means "placement closed / filled", so the admin can't tell the two apart.

- Add a new value `client_rejected` to the `application_stage` enum (DB migration).
- Add it to `CLIENT_VISIBLE_STAGES` and `STAGE_LABEL` in `candidates.functions.ts`.
- Client portal **Reject** button → sets stage to `client_rejected` (not `closed`).
- Show a red "Rejected by client" badge on the candidate card in the client portal so they see their own decision.

## 2. Admin/recruiter "needs replacement" signal

In `src/routes/ongoing.tsx`:

- For each position row, compute `rejectedCount = apps where stage === 'client_rejected'`.
- If `rejectedCount > 0`, show an amber `AlertCircle` exclamation badge next to the position title: "N rejected · needs replacement".
- Inside the expanded row, render rejected candidates in a separate "Rejected by client" group with the rejection visible.
- Add a **Replace** button (next to the existing "Open full position" link) that navigates to `/scout?positionId={position.id}`. The Scout page already accepts a `positionId` search param and uses the JD/skills from that position to seed sourcing — no change needed there.

Same exclamation/Replace affordance also added to the position detail page header (`positions.$positionId.tsx`) for parity.

## 3. Fix the three client buttons

Root cause review for `client.positions.$positionId.tsx`:

- **Shortlist** and **Schedule interview** call `updateApplicationStage` correctly, but the UI only invalidates `client-position-apps` + `client-applications-all`. The staff `applications` cache key isn't touched, so on the recruiter side the change doesn't appear until refresh. We'll also invalidate the shared `applications` key.
- **Schedule interview** currently only flips the stage — it does NOT create an `interviews` row, so nothing shows up under `/interviews`. We'll change this button to navigate the client to a lightweight request flow: stage moves to `interview_scheduled` AND a record is inserted (via a new `requestClientInterview` server fn) with status `pending_confirmation`, so the recruiter sees it in the interviews list and can confirm/finalize the time. This matches the existing `pending_confirmation` enum value.
- **Reject** — fix per §1 (was writing `closed` which got filtered as "filled").

We'll also verify by triggering the mutation in the browser after the build and watching the network response.

## 4. Files touched

- `supabase/migrations/<new>.sql` — add `client_rejected` to `application_stage` enum.
- `src/lib/candidates.functions.ts` — include new stage in arrays + label map; widen `CLIENT_VISIBLE_STAGES`.
- `src/lib/interviews.functions.ts` — add `requestClientInterview` server fn (client-callable, inserts pending interview + flips stage).
- `src/routes/client.positions.$positionId.tsx` — wire Reject → `client_rejected`; wire Schedule interview → `requestClientInterview`; invalidate `applications` key; add "Rejected" badge.
- `src/routes/ongoing.tsx` — exclamation badge + "Replace" button per position; rejected candidates section in expanded row.
- `src/routes/positions.$positionId.tsx` — same exclamation + Replace button in the header.

## 5. Out of scope

- No changes to AI Talent Scout itself (it already reads `positionId` from the URL).
- No notification/email — only in-app visual signal for now. (Can add later if needed.)
