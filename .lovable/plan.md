## Goal
Replace all "Loading…" text placeholders with skeleton loaders that visually match the final rendered content across the recruiter dashboard and client portal.

## Approach
Use the existing `Skeleton` primitive from `src/components/ui/skeleton.tsx`. For each loading state, render a skeleton tree with the same dimensions, spacing, and grid structure as the loaded UI — so layout doesn't shift on data arrival.

## Scope (routes to update)

**Recruiter side**
- `src/routes/dashboard.tsx` — KPI cards, activity feed, any "Loading…" blocks
- `src/routes/ongoing.tsx` — position rows (avatar + title + badges)
- `src/routes/pipeline.tsx` — kanban columns with card skeletons
- `src/routes/positions.tsx` — list/grid rows
- `src/routes/positions.$positionId.tsx` — header + candidate rows
- `src/routes/interviews.tsx`, `interviews.$processId.tsx`
- `src/routes/messages.tsx`, `tasks.tsx`, `activity.tsx`, `team.tsx`, `billing.tsx`, `closed.tsx`, `pending.tsx`, `scout.tsx`, `database.tsx`, `clients.$clientId.tsx`

**Client portal**
- `src/routes/client.index.tsx` — KPI card skeletons + position card skeletons (replace the `Loader2` "Loading positions…" block)
- `src/routes/client.positions.tsx`
- `src/routes/client.positions.$positionId.tsx`
- `src/routes/client.team.tsx` — member card skeletons (replace `Loader2` block)
- `src/routes/client.pipeline.tsx`, `client.interviews.tsx`, `client.messages.tsx`, `client.documents.tsx`, `client.placements.tsx`, `client.activity.tsx`, `client.reports.tsx`

**Shared components**
- `src/components/notification-bell.tsx` — small skeleton rows in the dropdown
- `src/components/chat-thread.tsx` / `db-chat-thread.tsx` — message bubble skeletons if they show loading text

## Pattern

Create small co-located skeleton components per route (e.g. `PositionCardSkeleton`, `KpiCardSkeleton`, `MemberCardSkeleton`) that mirror the real markup with `<Skeleton className="h-X w-Y" />` swapped in for text, avatars, and badges. Render 3–6 placeholder items in lists, matching the grid columns used by the real content.

Gate on `isLoading` (or `!session` where relevant) and render the skeleton tree instead of the current `Loader2` / "Loading…" text. Keep all data-fetching logic unchanged — this is presentation-only.

## Out of scope
- No changes to server functions, queries, or business logic
- No new design tokens; reuse existing `bg-primary/10` from the `Skeleton` primitive
- No animation library additions

## Verification
After edits, navigate through each route in the preview with a throttled network / fresh load to confirm skeletons render and match the loaded layout without shift.
