## Problem

On the client portal's **Interviews → Past** tab, each completed interview only shows a generic **"Submit feedback"** button that does nothing. After the client interviews a candidate, they should be able to actually act on the outcome — move the candidate forward, reject them, or request another round.

## Proposed flow

Replace the lone "Submit feedback" button on past interviews with a small decision panel. Three actions, plus an optional feedback note:

1. **Select candidate** → move the application to `offered` (so it shows in the recruiter's pipeline as ready for offer).
2. **Reject** → move the application to `client_rejected`. Asks for a short reason (optional but encouraged).
3. **Schedule next round** → move the application back to `interview_scheduled`; recruiter then sets up the next round in the existing interview detail page.

The optional feedback note is saved as an `activity` row (kind `note`, `client_visible: true`) tied to the candidate/position so the recruiter sees it in the activity feed. The interview itself stays as the historical record (no schema change needed).

## What changes

### Frontend
- `src/routes/client.interviews.tsx`
  - Past-tab row gets a compact action cluster: **Select** (primary), **Reject** (subtle destructive), **Next round** (outline), plus a small "Add note" link that expands a textarea.
  - Disable actions once a decision has already been recorded for that application (i.e. stage already `offered` / `client_rejected`), and show the current outcome inline instead ("Selected", "Rejected").
  - On success, invalidate `client-interviews`, `client-pipeline`, and `staff-interviews` queries.

### Server functions (new, in existing files)
- `src/lib/interviews.functions.ts` (or `applications.functions.ts` if you prefer — currently stage updates live inline in pipeline code; I'd add them here next to the interview row they act on):
  - `recordInterviewDecision({ applicationId, decision: "select" | "reject" | "next_round", note?: string })`
    - Uses `requireSupabaseAuth`; relies on existing RLS policy `"client updates own application stage"` for the stage transition (client already has UPDATE rights for these stages).
    - Updates `applications.stage` accordingly.
    - If `note` provided, inserts an `activities` row (`kind: "note"`, `client_visible: true`, `candidate_id`, `position_id`, `application_id`).

### No DB migration required
The `application_stage` enum already includes `offered`, `client_rejected`, `interview_scheduled`. The RLS policy `"client updates own application stage"` already permits the client to set these. No schema or policy changes needed.

## Out of scope (mentioned in case you want them later)
- A structured feedback form (scores per round, strengths/concerns) — current scope is one free-text note.
- Mirroring the same decision UI inside the recruiter-side `/interviews/$processId` page — that page already has full status/stage controls; if you want a one-click "client decided" shortcut there too, say the word.
- Notifications to the recruiter when a decision is recorded.