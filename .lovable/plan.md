
# QA Fixes — Admin & Client

This is a large list (12 issues across two surfaces). I'll group them into 3 batches so each can be verified before moving on. **Batch 1 = release blockers**, Batch 2 = client UX, Batch 3 = polish/perf.

Before I start, two quick clarifications inline at the end.

---

## Batch 1 — Release Blockers

### 1. Rejected candidates not visible on Admin
- Today `client_rejected` is in `CLIENT_VISIBLE_STAGES` and policies, but the Ongoing/Pipeline admin views likely filter it out.
- Fix: include `client_rejected` in admin pipeline/ongoing queries; add a "Rejected by client" group/badge in `src/routes/ongoing.tsx` and `src/routes/pipeline.tsx`.
- Activity log already records stage_change — surface latest stage transition on candidate row.

### 2. Reschedule button not working (client + admin)
- `src/routes/client.interviews.tsx` Reschedule is a static `<button>` with no handler. Same likely on admin `interviews.tsx`.
- Fix: wire a Reschedule dialog (date/time + reason) → `updateInterview` server fn → mark status `pending_confirmation`, log activity, create notification for the counterpart role.

### 3. Date filter throws error
- Need to locate the offending filter (likely on `activity.tsx`, `billing.tsx`, or `tasks.tsx`).
- Fix: replace any `new Date(str)` parse with a safe parser (DD/MM/YYYY + ISO), clamp invalid ranges, guard empty values.

### 4. Salary field showing 0
- `positions.salary` is `text` — "0" suggests UI prints raw value or `formatInrShort(0)` on null.
- Fix: in position cards/detail, render `—` when salary is empty/"0"/non-numeric; keep `formatInrShort` only when a real number is parsed.

### 5. Pending requirements missing ("25 not showing")
- `src/routes/pending.tsx` likely caps at default Supabase 1000 or filters by status incorrectly.
- Fix: audit filter (`status = 'open'`), remove stale client-side filtering, ensure dashboard counter uses same source as Pending list.

---

## Batch 2 — Admin Candidate & Client UX

### 6. Candidate profile validation / duplicates
- Add duplicate detection in `createCandidate` and sourced→shortlist promotion: dedupe by normalized `email`, `phone`, and a simple `lower(name)+current_company` key. Surface "Possible duplicate of X" warning before insert.
- Improve match search: trigram index on `candidates.name` + `skills` overlap scoring (already partly in scout-match).

### 7. Client back-button to Open Requirements
- `src/routes/client.positions.tsx` → detail nav loses filter/page state.
- Fix: persist filters in URL search params (`?status=open&page=2&q=…`) so browser back restores state naturally; use `Route.useSearch()`.

### 8. "No match found" empty state
- Replace bare empty divs in scout/positions/pipeline with a shared `EmptyState` (icon + suggestion + CTA "Adjust filters" / "Run Scout").

### 9. Progress % stuck at 0%
- Position progress likely counts only `offered/closed` apps.
- Fix: weighted score by stage (sourcing 10%, shortlist 30%, shared 50%, interview 70%, offered 90%, closed 100%). Compute in `positions.functions.ts`.

### 10. Extra JD upload error
- `client.positions.$positionId.tsx` upload to `documents` bucket — likely missing size/mime check or path collision.
- Fix: validate size ≤10MB, mime in (pdf/docx/txt), unique storage path `client/{clientId}/positions/{positionId}/jd-{ts}.{ext}`, toast on error.

### 11. Requirement details format
- Standardize `client.positions.$positionId.tsx` layout: header card (title/status/openings/salary/location/exp) → JD section → Skills → Pipeline → Documents → Activity. Consistent spacing (`space-y-6`, `rounded-xl border bg-card p-6`).

---

## Batch 3 — Performance polish

### 12. Admin smoothness
- Add `staleTime: 30s` to heavy list queries (positions, candidates, applications).
- Skeleton loaders on Ongoing/Pipeline/Dashboard.
- Memoize `CandidateRow` and stage groupings; remove redundant `listApplications` calls per page.

---

## Quick clarifications

1. For **rejected candidate sync** — do you want rejected candidates to appear as a **separate "Rejected" tab/group** on Ongoing, or inline within each position with a red badge?
2. For **duplicate detection** — should creating a duplicate be **blocked** (hard error) or **warned** (soft, user can override)?

Reply with answers + "go" and I'll start with Batch 1. If you'd rather I just pick sensible defaults (separate tab; soft warn), say "go with defaults".
