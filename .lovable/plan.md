## Problem

Clicking **Create Agency** navigates to `/superadmin/agencies/new`, but the page renders blank and throws:

> Invariant failed: Expected to find a match below the root match in SPA mode.

### Root cause

In TanStack Router's flat file convention, `src/routes/superadmin.agencies.tsx` is treated as the **parent layout** for its siblings `superadmin.agencies.new.tsx` and `superadmin.agencies.$id.tsx`. A parent must render `<Outlet />` for children to mount, but `superadmin.agencies.tsx` currently renders the full `AgenciesPage` UI with no `<Outlet />`. So `/superadmin/agencies/new` matches, but there's nowhere to render the child — hence the invariant error.

## Fix

Rename `src/routes/superadmin.agencies.tsx` → `src/routes/superadmin.agencies.index.tsx`, and update its `createFileRoute` path from `/superadmin/agencies` to `/superadmin/agencies/`.

That makes the agency list a leaf at `/superadmin/agencies`, and removes the implicit parent-layout requirement. `superadmin.agencies.new.tsx` and `superadmin.agencies.$id.tsx` continue to work as independent flat routes — no Outlet needed.

No other file edits are required. The Vite plugin regenerates `routeTree.gen.ts` automatically.

## Out of scope

- No changes to `createAgency` server function (it works; the page just never reached it).
- No DB or RLS changes.
