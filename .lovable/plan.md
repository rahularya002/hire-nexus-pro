## What's happening today

You're right — most of what shows on the **Dashboard**, **Team**, **Client portal home**, **Billing invoice detail** and a few other places is hard-coded mock data from these files:

- `src/lib/mock-data.ts` (clients, positions, today's interviews)
- `src/lib/ops/store.ts` (tasks, SLA warnings, daily digest, recruiter roster)
- `src/lib/chat-data.ts`, `src/lib/billing-data.ts`, `src/lib/client-data.ts`, `src/lib/portal-state.ts`

Meanwhile the actual DB has only **1 client, 1 position**, nothing else — so the live-data pages (Pipeline, Interviews, Tasks, Activity, Billing list, Placements, Messages, Notifications) look empty.

I'll fix this in two passes: **seed real data**, then **rewire screens to read from DB**.

---

## Plan

### 1. Seed realistic data into the DB
One insert script that adds, scoped to the existing `Acme` client + the 3 real users (admin, recruit, client):

- **5 more clients** (Reliance Brands, PhonePe, Swiggy, Nykaa, Razorpay) with colors/industry/contacts
- **~10 positions** across those clients (mix of open / in_progress / interviews / closed, varied priority, a few assigned to `recruit@gmail.com`)
- **~15 candidates** with skills/experience
- **~20 applications** spread across stages (sourcing → shared_with_client → client_shortlist → interview_scheduled → offered → closed)
- **~6 interviews** (some today, some upcoming, mixed status)
- **~12 tasks** across all states (Pending, Ongoing, Interview Pending, Closed, Reopened, No-show) with realistic SLA + due labels, assigned to recruiter
- **~15 activities** (some `client_visible=true` so the client portal feed populates)
- **3 placements** + **3 invoices** (draft / sent / paid) + line items, plus `client_billing_terms` for each client
- **1 message thread per client** with 2–3 messages each
- **A handful of notifications** for the admin user

### 2. Rewire dashboard & key screens to read live data

| File | Change |
|---|---|
| `src/routes/dashboard.tsx` | Replace `clients` / `positions` / `todaysInterviews` / `opsTasks` / `tasksByState` / `pendingConfirmations` / `slaWarnings` / `dailyDigest` / `recruiters` / `inactiveClientsAll` with `useQuery` calls to existing server fns (`listClients`, `listPositions`, `listInterviews`, `listTasks`, `listActivities`, `listTeam`) and compute the digest counts/SLA from real rows. Empty-state copy when 0 rows. |
| `src/routes/team.tsx` | Already partially DB-backed via `listTeam`; remove any remaining `recruiters` mock imports. |
| `src/routes/client.index.tsx` | Use `listPositions` (RLS scopes to client) + `listActivities` for the client portal home. |
| `src/routes/client.positions.tsx`, `client.positions.$positionId.tsx` | Same — drop `clientPositions` mock, use DB. |
| `src/routes/client.team.tsx` | Pull recruiter info from `listTeam` filtered to positions assigned for that client. |
| `src/routes/billing.invoices.$invoiceId.tsx` | Use `getInvoice` server fn (add if missing) — currently reads `billing-data.ts`. |
| `src/components/app-shell.tsx`, `client-shell.tsx`, `ui-bits.tsx`, `chat-thread.tsx` | Strip the mock imports they still reference (mostly type re-exports). |

### 3. Cleanup
- Keep `src/lib/mock-data.ts` etc. as **types-only** (export the TS types/enums still used by components) and remove the seeded constant arrays so nothing accidentally falls back to mock data.
- Leave `src/lib/client-data.ts` mock arrays for any screen we haven't migrated yet (Reports, etc.) — those are out of scope this turn unless you want them too.

### 4. Verify
- Log in as **admin** → dashboard shows real counts, real positions, real tasks, real activity feed.
- Log in as **client** → portal home shows their 1 position + activity from seeded data.
- Log in as **recruiter** → sees positions assigned to them, tasks assigned to them.

---

## Out of scope (ask if you want them too)
- Reports/analytics charts on `client.reports.tsx` (still mock-driven)
- The `src/lib/ops/store.ts` "recruiter live status" widget — there's no `recruiter_status` table; I'll either drop the live-status pill or derive a static "Active" until a real presence system exists. **Default: drop the live-status table on the dashboard and replace with the DB-backed Team list.**

Want me to proceed exactly as above?