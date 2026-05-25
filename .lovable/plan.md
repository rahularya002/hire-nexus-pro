## 1. Remove the starter prompts in AI Scout

In `src/routes/scout.tsx`:
- Delete the `STARTERS` array (lines 39–44).
- Remove the empty-state block (lines 297–312) that renders "Try one of these to get started:" and the 4 sample-prompt cards.
- Replace with a quieter empty state: small Sparkles icon + "Ask AI Talent Scout anything about sourcing, screening, or outreach." (no clickable examples).

No other Scout behavior changes — sources selector, client dropdown, JD prefill from `?positionId=`, and chat input all stay.

## 2. End-to-end workflow audit + fixes

I'll walk every primary flow in the app, list the issues I find, then fix them in the same turn. Targeted scope: navigation glitches, role-gating gaps, broken CTAs, missing toasts/loading states, and confusing dead-ends — not visual redesign or new features.

### Flows to audit

1. **Auth & onboarding**
   - `/signup` → `/login` → role-based redirect (`AuthGate` → `/dashboard` vs `/client` vs `/pending`).
   - Check: pending users see a clear "waiting for approval" screen, admin sees pending profiles in `/admin/clients`, approval actually flips `profiles.status` and unblocks the client.

2. **Client portal: JD upload → submit**
   - `/client` → `/client/upload`: file picker auto-fills form (already working), submit creates `positions` row + `documents` row, redirects to `/client/positions/:id`.
   - Check: success toast, disabled submit while saving, error surface, and that the new position actually appears in the admin `/positions` list.

3. **Admin: Open requirements → assign recruiter**
   - `/positions` (Open tab) → `/positions/:id` → AssignmentCard.
   - Check: the recently-fixed double-AppShell bug stays fixed, Assign/Reassign/Unassign work, notification fires to recruiter, "Scout candidates with this JD" CTA navigates to `/scout?positionId=...` and prefills.

4. **Recruiter: receives assignment**
   - Notification bell → click → lands on `/positions/:id`.
   - Check: recruiter sees assigned recruiter name in card (was broken, fixed last turn), can open Scout from the position, can move candidates through pipeline.

5. **Pipeline / Interviews / Placements / Billing**
   - `/pipeline`, `/interviews`, `/interviews/:processId`, `/billing`, `/billing/clients/:id`, `/billing/invoices/:id`.
   - Check: links between stages are wired both ways, no dead-end pages, role gates (admin vs recruiter vs client) match what's actually shown.

6. **Client mirror**
   - `/client/positions`, `/client/positions/:id`, `/client/pipeline`, `/client/interviews`, `/client/placements`, `/client/messages`, `/client/activity`, `/client/documents`, `/client/team`, `/client/reports`.
   - Check: no admin-only data leaks, every sidebar item has a working page, clients can't see other clients' data.

7. **Cross-cutting**
   - Notification bell: link targets exist, mark-as-read works.
   - Messages: thread routing.
   - Activity feed: shows recent events from the right tables.
   - Settings / Profile / Me / Team: role-gated correctly.
   - 404 / error boundaries on every route with a loader.

### Likely fixes (will confirm during audit)

- Stale React Query cache after assign / approve / submit JD → add missing `invalidateQueries` keys.
- Buttons that just `console.log` or `toast` without doing work.
- Sidebar links pointing to routes that don't exist (or that exist but `<AuthGate>` bounces).
- Missing loading skeletons on routes that fetch via server fns (causes blank flash → matches the dynamic-import runtime error currently in the preview).
- Notification rows without a `link_to`, or pointing at a route the recipient role can't access.
- Client-side routes that fetch admin data and silently 403.
- Race conditions where `AuthGate` decides before `profileLoaded` (already partly fixed — verify the rest).

### Out of scope for this turn

- Visual redesign / new features.
- Schema or RLS changes (unless an audit item is literally a security bug, in which case I'll call it out and ask before migrating).
- Replacing mock data with real data where the app intentionally uses mock fixtures.

## Technical details

Files I expect to touch:
- `src/routes/scout.tsx` — remove STARTERS + empty state.
- `src/routes/positions.$positionId.tsx`, `src/routes/positions.tsx` — assignment + open-requirements polish.
- `src/routes/client.upload.tsx`, `src/routes/client.positions.tsx`, `src/routes/client.positions.$positionId.tsx` — submit flow + cache invalidation.
- `src/components/notification-bell.tsx`, `src/lib/notifications.functions.ts` — verify link targets.
- `src/components/auth-gate.tsx`, `src/lib/auth/auth-context.tsx` — only if I find a remaining race.
- `src/components/app-shell.tsx`, `src/components/client-shell.tsx` — only if sidebar items point to dead routes.
- Any route file missing `errorComponent` / `notFoundComponent` that crashes during audit.

No new dependencies, no DB migrations.
