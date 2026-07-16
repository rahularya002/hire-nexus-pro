## Goal
Let superadmins edit an agency's core details (name, slug, notes) and its owner's login info (email, password, full name) from the superadmin agency detail page.

## Changes

### 1. `src/lib/superadmin.functions.ts` — two new server functions
- `updateAgencyDetails({ id, name?, slug?, notes? })`
  - Super-admin gated. Updates `agencies` row via `supabaseAdmin`. Validates slug format `^[a-z0-9-]+$`.
- `updateAgencyOwnerLogin({ id, email?, password?, fullName? })`
  - Super-admin gated. Loads `agencies.owner_user_id`. Uses `supabaseAdmin.auth.admin.updateUserById` to change email/password (keeps `email_confirm: true`). Also updates `profiles.full_name` / `profiles.email` for the owner. No-ops any field left blank.

### 2. `src/routes/superadmin.agencies.$id.tsx` — new "Edit" panels
Add two cards on the detail page (below the existing "Manage subscription" block):

- **Agency details** card: inputs for Name, Slug, Notes + "Save details" button → calls `updateAgencyDetails`, toasts, refreshes.
- **Owner login** card: shows current owner email; inputs for New email, New password (with show/hide), Owner full name + "Save login" button → calls `updateAgencyOwnerLogin`, toasts, refreshes. Copy note: "Leave a field blank to keep it unchanged."

Both use existing `useServerFn` + query invalidation pattern already in the file.

## Out of scope
- Editing individual member logins (only the owner login is exposed here).
- Changing owner to a different user account.
