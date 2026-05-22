# End-to-end test — findings + fix plan

## What I did

Logged in as **client@gmail.com**, opened **/client/upload**, filled "Senior Backend Engineer - Test by AI" (Bengaluru, 5–8 years) and clicked **Submit JD**.

Result: red error banner — **"No client account linked to your login."**

## Root cause (confirmed)

The `client@gmail.com` profile *is* correctly linked — DB shows `clients.id = 301c7b12-…-7f63eaef457a` with `user_id = 6ded5f64-…` and `role = client`.

The failure is **RLS**. `src/routes/client.upload.tsx` runs a browser-side query:

```ts
supabase.from("clients").select("id").eq("user_id", user.id).maybeSingle()
```

But `public.clients` only has one SELECT policy — **"Staff can view clients"** (admin / lead_recruiter / recruiter). There is **no policy letting a client read their own clients row**, so the query returns 0 rows and we throw "No client account linked".

Same gap will hit any other client-portal page that needs to read its own `clients` row directly from the browser (profile/header, account team, etc.).

Until this is fixed, **the admin cannot see the request** (nothing is created) and the recruiter-assignment step can't even start.

## Fix plan

### Step 1 — Migration: let clients read their own clients row

Add a new RLS policy (does not weaken staff access, does not expose other clients):

```sql
CREATE POLICY "Clients view own client row"
  ON public.clients FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
```

That's the minimal, surgical fix that unblocks `/client/upload` and any future client-portal read of `clients`.

### Step 2 — Resume the end-to-end test (no code changes)

1. As **client@gmail.com** → `/client/upload` → submit the same JD → expect success screen.
2. Verify in DB that a row landed in `positions` with `client_id = 301c7b12-…`.
3. Log out, log in as **admin@gmail.com** → `/positions` (and `/dashboard`) → confirm the new requirement is visible.
4. Open the position → assign **recruit@gmail.com** as the owning recruiter (whichever assign UI the position detail exposes — `positions.$positionId`).
5. Log out, log in as **recruit@gmail.com** → `/positions` (or `/dashboard`) → confirm the recruiter sees the assigned position.

### Step 3 — Report findings

After step 2, I'll summarise: which steps passed, which UI looked broken, and any further RLS / assignment gaps I hit while testing (recruiter assignment may need its own follow-up — I'll know once I reach that screen).

## Notes / scope

- Only one DB migration; no app code changes needed to unblock the test.
- I'll keep the rest of the test purely interactive — no other edits unless we hit another blocker, in which case I'll stop and report before touching code.
