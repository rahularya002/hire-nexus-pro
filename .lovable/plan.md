## Goal

The "Master settings" page (integrations, sourcing actors, AI ranking, interview round templates) is currently at `/admin/settings` inside the agency portal. Move it under the Super Admin portal so only platform owners (`super_admin`) can manage platform-wide configuration.

## Changes

### New route
- Create `src/routes/superadmin.settings.tsx` at `/superadmin/settings`.
  - Wraps content in `SuperAdminShell` (instead of `AppShell`).
  - Drops the in-component `admin / lead_recruiter` role check (the shell already gates on `super_admin`).
  - Reuses the exact same UI and sections: Service integrations, Sourcing actors, AI ranking, Interview rounds.
  - Reuses existing server functions in `src/lib/admin-settings.functions.ts` and `src/lib/interview-templates.functions.ts` unchanged.

### Super Admin navigation
- Add a "Settings" item (gear icon) to the `NAV` array in `src/components/superadmin-shell.tsx`, pointing to `/superadmin/settings`.

### Remove old entry point
- Delete `src/routes/admin.settings.tsx`.
- Remove any links to `/admin/settings` in the agency shell / sidebar (`src/components/app-shell.tsx`) so the agency portal no longer surfaces it.

### Access
- Server functions stay as-is — they only require an authenticated user. Since the only route that calls them now lives behind the Super Admin shell, only super admins can reach them through the UI. (No DB / RLS change needed for this move.)

## Out of scope
- No schema changes.
- Not splitting "Interview rounds" into a per-agency setting — it moves with the rest. If you want round templates to remain agency-editable later, that's a separate task.
