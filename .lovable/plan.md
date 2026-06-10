## 1. Fix "Pending approval" flashing dialog

**Cause:** `AuthProvider.onAuthStateChange` (in `src/lib/auth/auth-context.tsx`) currently runs on every event Supabase emits — including `TOKEN_REFRESHED` (~hourly + on tab focus) and `INITIAL_SESSION` (every mount). Each time it resets `profileLoaded = false`, re-fetches profile/roles, and calls `router.invalidate()` + `queryClient.invalidateQueries()`. While `profileLoaded` is briefly false, gated screens flicker, and login/AuthGate redirect logic can momentarily route to `/pending` before roles re-populate.

**Fix:**
- Filter the auth-state callback to only act on identity transitions: `SIGNED_IN`, `SIGNED_OUT`, `USER_UPDATED`. Ignore `TOKEN_REFRESHED` and `INITIAL_SESSION`.
- Do not reset `profileLoaded` on token refresh.
- Only call `queryClient.invalidateQueries()` when a session is present (skip on `SIGNED_OUT` to prevent 401 storm).
- Keep the initial `getSession()` bootstrap as-is.

## 2. Fix "Can't click a client in Billing to change billing period"

**Cause:** `src/routes/billing.tsx` only renders clients inside the **Upcoming invoice runs** list, which is built from `upcomingRuns()`. For the current agency (Agency 1 / AI Tech) there are no placements yet, so the section shows entries but the page has no dedicated "All clients" entry list; users assume the cards aren't clickable. There is also no entry point for a brand-new client with no terms set.

**Fix in `src/routes/billing.tsx`:**
- Add a top-level **Clients** section listing every client in the agency (use existing `listClients`/agency clients fetch). Each row links to `/billing/clients/$clientId` with: name, current billing cycle + Net days (or "Set terms" if none), and a chevron.
- Keep "Upcoming invoice runs" below as a secondary view.
- Ensure rows are obviously clickable (hover state + chevron, role=link).

No changes to billing terms editor itself — `EditTermsDialog` on the client page already lets the user change `payment_terms_days` (Net), `billing_cycle`, and `invoice_day_of_month`.

## 3. Pipeline — filter by client

**File:** `src/routes/pipeline.tsx`

- Add a client filter pill row above the Kanban (derive distinct clients from `apps[].position.client`).
- Default = "All clients". Selecting a client filters `apps` before the per-stage `filter()`.
- Update the summary line (`N candidates across M mandates`) to reflect the filter.
- Persist selection in URL search param `?clientId=` so it survives reloads/back-nav.

## 4. Out of scope (per your reply)

- Contract duration / weekly-monthly profile refresh — skipping for now. The replacement-window concept already exists on `client_billing_terms.replacement_window_days` and is editable from the client billing page; we'll align that with billing-period semantics when you're ready.

## Technical notes

- No DB migrations needed for any of the above.
- `AuthProvider` change is the highest-leverage fix — it also stops periodic refetch thrash across the app.
- Billing list addition reuses existing server fns; no new endpoint required (we can extend `upcomingRuns` to include clients with zero placements, or add a parallel `listAgencyClientsForBilling` fn — preferring the latter to keep `upcomingRuns` semantics intact).
