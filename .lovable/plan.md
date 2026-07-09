# Fix `/posting` crash

## What's actually happening

`/posting` throws inside the component tree and the root `errorComponent` in `src/routes/__root.tsx` catches it — that's the dark "This page didn't load / Try again / Go home" screen you saw. The route itself works: rendered fine in a headless browser signed in as an agency admin (empty state, sidebar, header all present). So the crash is conditional on the current session or a runtime edge case, not a broken route.

Three likely causes, in order of probability:

1. **Session mismatch** — signed in as a client account or as a recruiter without an `agency_members` row. `listJobPosts` runs, returns `[]` under RLS, but a downstream assumption (channels/counts) throws.
2. **Stale/expired token** — the server function returns a 401 and the error surfaces during render instead of being handled.
3. **No agency scope on the query** — `listJobPosts` never filters by `agency_id`; if a user has multiple agency memberships or none, the query can return odd shapes that break the card render.

## Fix in one turn

**Step 1 — reproduce with your session**
Playwright run with your `LOVABLE_BROWSER_*` credentials against `/posting`; capture console + pageerror + network. This tells me which of the three causes is real in ~30s.

**Step 2 — harden the route regardless of which cause it is**

- Wrap `Page()` in a local error boundary that shows an inline "Couldn't load posts — Retry" card instead of blowing up the whole app tree.
- In `listJobPosts` (`src/lib/posting.functions.ts`), explicitly scope by the caller's agency: look up `agency_members.agency_id` for `userId`, return `[]` if none, filter `job_posts` by that `agency_id`. Same treatment for `job_post_channels` join.
- Defensive nulls in `PostCard`: `post.channels ?? []` is already there, but also guard `post.applications_count` and `post.status`.

**Step 3 — targeted fix for whatever step 1 revealed**

- If it's session/auth → clear stale token + redirect to `/login` from the boundary, don't crash.
- If it's a specific row shape → tighten the Zod/serialization on the server side.

**Step 4 — verify**
Re-run Playwright with the same session, confirm the page renders (empty state or list). Check console is clean.

## Files that will change

- `src/routes/posting.index.tsx` — local error boundary + null guards
- `src/lib/posting.functions.ts` — agency-scoped query, safer return shape

No schema changes, no migrations.

Approve this and I'll run the repro + ship the fix in the next turn.
