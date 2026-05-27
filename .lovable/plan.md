
## Scope

Changes are UI/frontend only — no schema or business-logic changes.

### 1. Client JD Upload (`src/routes/client.upload.tsx`)

- **Remove "Run Talent Scout" button** and the `ScoutResults` panel that renders below the form on the client side.
- Keep the `ScoutResults` component code but lift it out — move the component definition + `ScoreBadge` into a shared file `src/components/scout-results.tsx` so the admin Scout can reuse it.
- Delete the now-unused `useServerFn(scoutCandidates)`, `scouting`/`scoutError`/`candidates` state, and the `handleRunScout` handler from `client.upload.tsx`.
- **Add a "JD Format Guide"** — a collapsible info card at the top of the upload form showing what a well-structured JD should contain, mapped to our form fields:

  ```text
  • Job title — e.g. "Senior React Engineer"
  • Location — city / remote
  • Experience required — e.g. "5–8 years"
  • Salary range — with currency
  • No. of openings
  • Required skills — comma separated
  • Job description — responsibilities, must-haves, nice-to-haves
  ```

  Rendered as a dismissible/expandable card with a `FileText` icon so clients know exactly how to format their JD for best auto-fill results.

- **Salary input — multi-currency**: replace the single `salary` text field with a two-control row:
  - a `currency` `<select>` (INR ₹, USD $, EUR €, GBP £, AED د.إ) — default INR
  - a numeric/text amount input ("40-60 LPA", "120k-150k", etc.)
  - The combined value is saved as `"<symbol> <amount>"` into the existing `salary` column so no DB change is needed.
  - JD auto-fill (`extractFieldsFromJd`) keeps working — when it returns a salary string, we pre-set currency by detecting `₹/INR/$/€/£` and put the rest in the amount field.

- **Openings input — no negatives**: add `min={1}` and an `onChange` guard that clamps to `>=1`. Also set `inputMode="numeric"` and strip non-digits.

### 2. Admin AI Scout (`src/routes/scout.tsx`)

- Add a **"Generate candidate matches"** action in the Scout page that calls `scoutCandidates` (the same server fn the client page used) using:
  - the currently selected client + position context (already tracked via `clientId` / `positionId` in the page)
  - or the current chat thread's last user message as the brief if no position is selected
- Render results using the shared `<ScoutResults />` card list (the same exclusive-looking format the client page had) in a panel below the chat.
- The existing streaming chat remains the primary interaction; the match panel is an additional capability so admins/recruiters get the structured card view that was previously client-only.

### 3. Client "View detail" link fix (`src/routes/client.positions.tsx` → `src/routes/client.positions.$positionId.tsx`)

The `<Link to="/client/positions/$positionId">` looks correct and the route file exists, so the user-visible failure is most likely one of:

- the detail route's `getPositionById` server fn rejecting because the client user doesn't pass the position-ownership check, returning an error that the page surfaces as a blank/error screen; or
- `listApplications` not authorising the client role for that position.

Plan: open `client.positions.$positionId.tsx` plus `getPositionById` / `listApplications` in `positions.functions.ts` and `candidates.functions.ts`, confirm the failure (error boundary, network 401/403, or missing data), and patch the offending guard so a client viewing their own position succeeds. If it turns out to be a missing `errorComponent` swallowing a thrown error, add one so we can see the real cause and fix it.

## Files touched

- `src/routes/client.upload.tsx` — remove scout button + state, add JD format guide, swap salary input, clamp openings.
- `src/components/scout-results.tsx` *(new)* — extracted `ScoutResults` + `ScoreBadge`.
- `src/routes/scout.tsx` — import shared `ScoutResults`, add "Generate matches" action + panel.
- `src/routes/client.positions.$positionId.tsx` and/or `src/lib/positions.functions.ts` / `src/lib/candidates.functions.ts` — fix whichever guard is blocking the client detail view (exact edit confirmed during build).

## Out of scope

- No DB migration (salary stays a single text column; we just compose currency + amount on the client).
- No changes to `scoutCandidates` server fn itself.
- No redesign of the Scout chat UX beyond adding the match panel.
