# Real client creation with admin-set password

## Problem

The "Onboard new client" modal in `src/routes/admin.clients.tsx` is a mock — two cosmetic steps with non-functional inputs. There's no real account creation, no real password field, and nothing is written to the backend.

## Fix

Mirror the recruiter flow: admin types email + password directly, a single server call creates the auth user, profile, and role.

### 1. New server function — `createClientAccount`

Add to `src/lib/team.functions.ts` (next to `createTeamMember`):

- Inputs (zod): `email`, `password` (min 8), `fullName`, `companyName`
- Admin-gated via `assertAdmin`
- Uses `supabaseAdmin.auth.admin.createUser` with `email_confirm: true`
- Updates `profiles` with `full_name`, `company_name`, `status: 'active'`
- Inserts `user_roles` row with `role: 'client'`
- Returns `{ ok, userId, email }`

### 2. Rewrite `OnboardModal` in `src/routes/admin.clients.tsx`

Single-step form with these real fields:
- Company name
- Contact person (full name)
- Login email
- Password (with show/hide toggle, min 8 chars validation)

Submit → `useServerFn(createClientAccount)` → toast success/error → close modal. Show inline validation errors. The legacy two-step UI and the "auto-generated / welcome email" placeholder text go away.

Note: the admin-side mock `clients` list in `mock-data.ts` is unrelated to the real client-portal account being created here. It stays as-is for the dashboard tables.

## Files

- `src/lib/team.functions.ts` — add `createClientAccount`
- `src/routes/admin.clients.tsx` — replace `OnboardModal` with real form + wire submit

No DB migration needed — `profiles`, `user_roles`, and the `client` role already exist.
