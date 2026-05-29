## Plan

Two phases. Phase 1 closes out the remaining QA gaps. Phase 2 fixes every confirmed bug in a single batch.

---

### Phase 1 — Finish QA (read-only, browser only)

**Recruiter portal** (`recruit@gmail.com`)
- `/positions`, `/pipeline`, `/interviews`, `/database`, `/team`, `/activity`, `/messages`, `/scout`
- Confirm role gating: recruiter must NOT see `/admin/*` or `/billing`

**Detail routes** (as admin)
- `/positions/$id` — JD, candidate list, stage moves render
- `/interviews/$processId` — rounds timeline, feedback
- `/clients/$clientId` — positions, contacts, activity
- `/billing/invoices/$invoiceId` and `/billing/clients/$clientId`

**One end-to-end flow** (as admin, read-only walkthrough)
- Position → Pipeline candidate → Interview process → Placement → Invoice — confirm cross-links resolve and IDs reconcile.

I'll skip destructive actions and report findings inline.

---

### Phase 2 — Bug fixes (batch)

From the previous QA pass, confirmed issues to fix:

1. **Client sidebar — wrong active highlight**
   `src/components/client-shell.tsx` — Overview item matches `/client` with `startsWith`, so it stays active on every child route. Fix: keep `exact: true` for Overview (already set) but the issue is the same prefix match catches `/client/positions` for "My Requirements" because `/client/positions` ⊃ `/client/pipeline`? Actually root cause: "My Requirements" (`/client/positions`) and others use `pathname.startsWith(item.to + "/")`. Need stricter check — for the position-detail route `/client/positions/$id`, both Overview and My Requirements light up if Overview's matcher is loose. Will switch to exact-or-segment-prefix and verify Overview only matches `/client`.

2. **"Switch to Agency view — Resume · Rolex India" in client sidebar footer**
   `src/components/client-shell.tsx` lines ~94–115 + ~170–185. Two problems:
   - The footer button should be **hidden for client-only users** (only show when the logged-in user has `admin` or `recruiter` role in addition to client).
   - "Rolex India" is pulled from `clients[0]` via `getSelectedClientId()` fallback — hardcoded mock. Will gate the entire footer block behind `roles.includes("admin") || roles.includes("recruiter")`.

3. **Client Overview KPIs show 0 / flicker** (`src/routes/client.index.tsx`)
   `listPositions` and `listApplications` are called with `data: {}` — for a client user they should be auto-scoped server-side to the logged-in client, but the count mismatch suggests either (a) cache key collides with admin's cached data, or (b) server fn doesn't scope by role on first SSR pass. Will:
   - Use distinct query keys that include the user id (`["client-positions", userId]`).
   - Verify `listPositions` / `listApplications` server fns filter by `context.userId` → `clients.user_id` when caller is a client. Patch if missing.

4. **Cross-portal count mismatch**
   Likely the same root cause as #3 — once client scoping is fixed and admin "My open positions" filter is documented (it filters to positions owned by the logged-in recruiter/admin, not all open), the numbers reconcile. Will add a short tooltip/subtitle on the admin Dashboard KPI ("Assigned to you") so the label is unambiguous.

5. **Loading flicker (2–4s "Loading…")**
   Convert the heaviest list routes to the loader+`ensureQueryData`+`useSuspenseQuery` pattern so data is primed before paint:
   - `/client` (Overview), `/client/positions`, `/client/pipeline`
   - `/positions`, `/pipeline`, `/interviews`
   Keeps existing UI; only swaps the fetch shape.

---

### Out of scope
- No schema or RLS changes unless Phase 2 #3 reveals server fns are missing client scoping (in which case I'll add a narrow filter, no migrations).
- No new features. Mock-data references in `client-shell.tsx` (`clients` import) will only be removed if they're behind a now-hidden block.

### Deliverable
After Phase 1, I'll post the QA findings; after Phase 2, a short "fixed / verified" summary with the routes I re-checked in the browser.
