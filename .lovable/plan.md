# Fix sidebar flipping on /messages (and related route-prefix bugs)

## Root cause

In `src/components/app-shell.tsx`:

```ts
const isRecruiterPortal = pathname.startsWith("/me");
```

`"/messages".startsWith("/me")` is `true`, so navigating to **Messages** flips the sidebar from the agency nav to the recruiter portal nav ("My Desk", "My Activity", etc.). Same trap would hit any future route starting with `/me…`.

The active-link highlight uses the same loose prefix check (`pathname.startsWith(item.to)`), which can also mis-highlight siblings (e.g. `/positions` vs `/positions/123` is fine, but `/me` would light up on `/messages` if it weren't already marked `exact`).

## Fix

1. **`src/components/app-shell.tsx`** — replace the portal check with a true segment match:
   ```ts
   const isRecruiterPortal = pathname === "/me" || pathname.startsWith("/me/");
   ```
2. **Harden the nav active check** in both `app-shell.tsx` and `client-shell.tsx` so prefix matching only counts whole path segments:
   ```ts
   const active = item.exact
     ? pathname === item.to
     : pathname === item.to || pathname.startsWith(item.to + "/");
   ```

That's it — purely presentation, no business logic touched. No other routes in the codebase currently collide, but the segment-aware matcher prevents the same class of bug from reappearing.

## Files

- `src/components/app-shell.tsx`
- `src/components/client-shell.tsx`
