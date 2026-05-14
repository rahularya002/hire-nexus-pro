# TalentFlow → Recruiter Operating System

This is a large scope. I'll deliver it in phased route additions on top of the existing TanStack Start architecture, theme tokens, and `AppShell`/`ClientShell`. All data stays in `src/lib/mock-data.ts` (extended) so every screen is interactive without a backend. AI features keep using the existing Lovable AI Gateway server functions.

## Architecture (kept as-is)
- File routes under `src/routes/` (no `src/pages/`).
- New shared modules under `src/lib/ops/` for task/recruiter/interview/finance/comms mock stores + selectors.
- New components under `src/components/ops/` (cockpit cards, candidate drawer, interview pipeline, timeline, roster table, finance tables).
- Theme tokens from `src/styles.css` only — no raw colors.

## Phase 1 — Recruiter Cockpit (`/dashboard` rebuild)
Replace the current dashboard with a dense "mission control" grid:
- My Active Clients · My Open Positions · Today's Interviews
- Pending / Ongoing / Closed Tasks (tabs) with states: Pending, Ongoing, Interview Pending, Closed, Reopened, No-show
- Candidate Confirmations Pending · Follow-Ups Pending · SLA Warnings
- Daily Digest (counts + deltas) · Recruiter Activity Status (self)
- Quick actions (call / WhatsApp / share / confirm) on every row

## Phase 2 — Recruiter Ops & Roster
- New route `/team` (roster): per-recruiter row → assigned positions, active clients, profiles shared today, closures, conversion %, current status (Available / Break / Offline / Active).
- New route `/team/$recruiterId` (profile): assigned clients, positions, daily shares, closures, joining/leaving date, login activity, attendance, leaves, active sessions.
- New route `/team/analytics`: closure conversion %, efficiency, recruiter comparison charts (recharts).
- Status pill in `AppShell` header with Available/Break/Offline toggle (persisted in `portal-state`).

## Phase 3 — Pipeline Drilldown & Candidate DB
- Clicking a stage count anywhere opens `/pipeline/$clientId/$positionId/$stage` (or a side drawer) listing candidates with: name, exp, salary, prev org, location, notice, AI match %, resume preview, actions (Select / Reject / Share to client / Return to DB).
- New route `/database`: structured candidate DB; rejected/skipped candidates flow back here, searchable, with sourcing history (previous roles, client submissions, recruiter actions).
- Per-client, per-position independent pipelines (Rolex → Boutique Manager / Watchmaker / Store Manager example seeded).

## Phase 4 — Communication Tracking
- Candidate detail drawer with Comms tab: WhatsApp sent, Email sent, Call completed, Follow-up pending, Confirmed, Awaiting response.
- Timeline component + recruiter notes (add note inline). Reused by candidate, position, and client views.

## Phase 5 — Interview Orchestration
- New route `/interviews` rebuilt: multi-round (HR / Manager / CEO / custom), reorderable rounds (dnd-kit), round progression tracking, visual pipeline.
- Slot selection / negotiation / reschedule / candidate-unavailable / no-show flows with statuses: Confirmed, Reschedule requested, No-show, Pending confirmation.
- Meeting provider picker (Google Meet / Teams / Zoom) — generates mock invite payload, calendar invite preview, CV attachment toggle, recruiter + candidate reminder toggles. (Real provider OAuth deferred — UI + mock links only.)

## Phase 6 — Manual Hybrid Controls
Everywhere a status moves automatically, expose a manual override menu: shortlist, interview progression, feedback entry, status movement, candidate progression. Audit each manual action into the timeline.

## Phase 7 — Clients (Inactive + Config)
- `/clients` adds inactivity badge (no positions / no closures in N months, configurable), reason field, re-engagement CTA.
- Per-client settings page: interview structure, SLA thresholds, approval flow, hiring process steps (configurable workflow JSON edited via UI).

## Phase 8 — Finance
- New route `/finance`: client-wise billing, MTD, YTD, revenue breakdown, closure analytics.
- Per closed position: joining date, invoice raise date, payment due date, candidate CTC.
- Invoice rules: immediate / +15 / +30 / +60 days, auto vs manual override, delayed scheduling. Mock invoice list with status.

## Phase 9 — CV Ingestion
Extend `/client/upload` + new `/database/upload`: accept PDF, DOC/DOCX, JPEG. Parse to structured candidate via existing AI gateway server function (`parseResume.functions.ts`). Per position metrics: candidate / interview / offer counts + hiring progress bar.

## Phase 10 — Filters, Timeline, Tasks
- Global filter bar component: client, company, recruiter, position, billing, closed-only.
- Operational timeline component (Sourced → AI matched → Recruiter shortlisted → Shared → Client shortlisted → Interview scheduled → Offer sent → Joined) used on candidate + position pages, plus offer/joining/closure tracking.
- New route `/tasks`: Trello-style board (Pending / Ongoing / Done) with task types: Call candidate, Confirm interview, Share shortlist, Follow up with client, Schedule round, Collect feedback. Drag between columns.

## Phase 11 — Client Portal Workflow
Extend `ClientShell` routes: shortlist / reject / feedback / interview round config / interview progression. Shares the same configurable workflow engine from Phase 7 so each client sees their own structure.

## Phase 12 — Mobile Optimization
Audit pass on cockpit, tasks, candidate drawer, interview confirm, status toggle: compact layouts, swipe actions (framer-motion), bottom action bar, one-tap confirmations. Test at 375×812.

## Technical details
- New deps: `@dnd-kit/core` + `@dnd-kit/sortable` (reorder rounds & tasks), `recharts` (already likely present — verify), `date-fns` for SLA math.
- Mock store: `src/lib/ops/store.ts` exports typed collections (recruiters, tasks, candidates, interviews, comms, invoices, workflows) seeded from existing `mock-data.ts`. Pure in-memory with `useSyncExternalStore` so updates propagate across screens without a backend.
- New server functions only where AI is involved (resume parse, daily digest summary). Everything else is client-state.
- Routing: all new routes registered as files in `src/routes/`; the Vite plugin regenerates `routeTree.gen.ts`.
- Theme: only `bg-background`, `text-foreground`, `text-primary`, etc. New status colors added as semantic tokens (`--status-available`, `--status-break`, `--status-offline`, `--status-warning`) in `src/styles.css`.

## Delivery order
Phases 1 → 3 → 5 → 4 → 10 → 2 → 8 → 7 → 11 → 6 → 9 → 12.
This front-loads the cockpit, pipeline drilldown, and interview orchestration — the screens that make the demo feel like an operating system — then layers analytics, finance, configurable workflows, manual controls, ingestion, and the mobile pass.

## Out of scope for this plan
- Real OAuth into Google/Microsoft/Zoom (UI + mock links only).
- Real database/auth (Lovable Cloud not enabled). If you want persistence + real auth + real recruiter accounts, say the word and I'll add a Phase 0 to enable Cloud and migrate the mock store to Postgres + RLS first.

Confirm and I'll start with Phase 1.
