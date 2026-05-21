# Fix dashboard gaps: profile/settings pages, greeting, login flash

Four small fixes to the agency portal so the post-login experience feels real.

## 1. Stop the "pending approval" flash after admin login

Today `src/routes/login.tsx` and `src/routes/pending.tsx` decide where to send the user the moment a `session` appears, but before `profileLoaded` is true. With no roles loaded yet, both files fall through to `/pending`, which renders for a frame and then re-redirects to `/dashboard` once roles arrive.

Fix: in both files, wait for `profileLoaded` from `useAuth()` before running the role-based redirect. No other logic changes.

## 2. Dynamic greeting + name + date on the dashboard

`src/routes/dashboard.tsx` currently hardcodes:

- `Mission Control · Wed, May 14`
- `Good afternoon, Aarav`

Replace with:

- Date string from `new Date()` formatted as e.g. `Thu, May 21` (locale `en-US`, weekday short + month short + day).
- Greeting derived from local hour: `Good morning` (<12), `Good afternoon` (<17), `Good evening` (otherwise).
- Name from `useAuth().profile?.full_name` → first token. Fallbacks: email local-part, then `there`.

No other dashboard content changes.

## 3. Add Profile page

New route `src/routes/profile.tsx` wrapped in `AppShell`. Read `profile`, `roles`, `user` from `useAuth()`. Show:

- Avatar (initials), full name, email, role badge, account status.
- An "Edit profile" card with `full_name` and `company_name` inputs that update `public.profiles` via the browser supabase client (the existing RLS policy "Users can update their own profile" already allows this) and then calls `refresh()` from auth context.

Wire the Profile dropdown item in `src/components/app-shell.tsx` to `<Link to="/profile">`.

## 4. Add Settings page

New route `src/routes/settings.tsx` wrapped in `AppShell`. Two simple sections:

- **Password** — change password via `supabase.auth.updateUser({ password })`.
- **Session** — sign-out button (mirrors the dropdown action).

Wire the Settings dropdown item in `app-shell.tsx` to `<Link to="/settings">`.

## Files touched

- edit `src/routes/login.tsx` — gate redirect on `profileLoaded`
- edit `src/routes/pending.tsx` — gate redirect on `profileLoaded`
- edit `src/routes/dashboard.tsx` — dynamic name/greeting/date in the header only
- edit `src/components/app-shell.tsx` — link Profile and Settings dropdown items
- add `src/routes/profile.tsx`
- add `src/routes/settings.tsx`

No DB migrations, no schema changes, no changes to mock data or the rest of the dashboard.