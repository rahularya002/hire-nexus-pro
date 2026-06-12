# Add Client-Side Scouting (Self / Hybrid models)

Right now `recruitment_model = self` shows a "Self" badge but the client has no way to source candidates — the existing AI Scout lives only on the agency side at `/scout`. When the client owns recruitment (Self) or shares it (Hybrid), they need the same Scout flow inside the client portal.

## What changes

### 1. New client route: `/client/scout`
- New file `src/routes/client.scout.tsx`, wrapped in `ClientShell`.
- Accepts `?positionId=...` search param (same shape as `/scout`).
- Reuses the existing UI: JD/text input, source pickers, results list via `<ScoutResults />`, shortlist/reject actions.
- Pre-scopes to the signed-in client's own positions only — no client picker dropdown (unlike agency `/scout` which lists all clients).
- Shortlisting a sourced candidate creates an `application` on the position with `submitted_by_kind = 'client'` so Pipeline + Reports correctly attribute it.

### 2. Entry points
- **Client sidebar** (`src/components/client-shell.tsx`): add a new nav item "Scout Candidates" (Sparkles icon) shown only when the client has at least one position with `recruitment_model` in (`self`, `hybrid`). Otherwise hidden to keep agency-only clients' UI clean.
- **Position detail** (`src/routes/client.positions.$positionId.tsx`): when `recruitment_model` is `self` or `hybrid`, add a primary button "Scout candidates" next to "Message recruiter" that links to `/client/scout?positionId=<id>`. Also replace the empty-state copy when `self` from "Your recruiter is sourcing profiles…" to "Start sourcing candidates for this role" with the same CTA.

### 3. Server-side access
- `src/lib/positions.functions.ts` — `getPositionById` and `listPositions` already filter by client ownership, no change needed.
- `src/lib/apify.functions.ts` — verify the scout/shortlist/reject server fns accept a client caller for positions they own. If currently agency-gated, relax to: allow if caller is the position's client OR an agency recruiter. Shortlist writes `submitted_by_kind = 'client'` when caller is the client.
- No DB migration required (column already exists).

### 4. Pipeline / Reports cosmetic
- In `src/routes/client.pipeline.tsx`, candidates with `submitted_by_kind = 'client'` get a small "Sourced by you" chip so the client can distinguish self-sourced vs agency-sourced in Hybrid mode. Read-only — no logic change.

## Files touched
- new: `src/routes/client.scout.tsx`
- edit: `src/components/client-shell.tsx`
- edit: `src/routes/client.positions.$positionId.tsx`
- edit: `src/lib/apify.functions.ts` (authorization + submitted_by_kind tagging)
- edit: `src/routes/client.pipeline.tsx` (chip only)

## Out of scope
- No changes to agency `/scout`, billing, interviews, or DB schema.
- No permission matrix wiring yet — any client member who can see the position can scout for it. (Hooking the existing `client_role_permissions` flags into the Scout button can be a follow-up.)
