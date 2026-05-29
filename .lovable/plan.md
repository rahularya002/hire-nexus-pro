## Goal

1. Admin can create/edit/delete a **global library of custom interview round types** (e.g. "Technical Round 2", "Founder Chat") on top of the existing built-in kinds.
2. Every interview round has a **"Conducted by"** dropdown — defaults to **Recruiter** (the position's assigned recruiter) and can be switched to **Client** (the client linked to the position, shown automatically).

## Database (one migration)

1. New table `public.interview_round_templates`
   - `id uuid pk`, `name text unique not null`, `default_conducted_by` (new enum, see below), `default_duration_minutes int default 60`, `sort_order int default 0`, `archived bool default false`, `created_by`, `created_at`, `updated_at`
   - GRANTs: `authenticated` SELECT, admin/lead INSERT/UPDATE/DELETE via RLS; `service_role` ALL
   - RLS: all authenticated can SELECT; only `admin` / `lead_recruiter` can write
2. New enum `interview_conductor` = `('recruiter','client')`
3. `ALTER TABLE public.interviews`
   - `ADD COLUMN conducted_by interview_conductor NOT NULL DEFAULT 'recruiter'`
   - `ADD COLUMN custom_kind_label text` (used when admin picks a custom template instead of a built-in `kind`; built-in `kind` stays for backward compat — default `hr_screen`)

Note: keeps existing data valid (default values), no destructive change.

## Server functions

`src/lib/interview-templates.functions.ts` (new):
- `listInterviewRoundTemplates`, `createInterviewRoundTemplate`, `updateInterviewRoundTemplate`, `deleteInterviewRoundTemplate` — admin/lead only via RLS.

`src/lib/interviews.functions.ts`:
- Extend `interviewSchema` with `conducted_by: z.enum(['recruiter','client']).optional()` and `custom_kind_label: z.string().max(120).nullable().optional()`.
- Extend `InterviewRow` type with the two fields.

## UI

1. **Admin Settings** (`src/routes/admin.settings.tsx`) — add a new "Interview Rounds" card:
   - Table of templates with inline add/edit (name, default conductor dropdown, default duration, archive toggle).
2. **Interview round dialog** in `src/routes/interviews.$processId.tsx` (create + edit):
   - Replace the current "Kind" select with a single **Round type** select that lists built-in kinds + active custom templates (custom ones write to `custom_kind_label`, built-in ones to `kind`). Selecting a template prefills `conducted_by` + `duration_minutes`.
   - Add a **Conducted by** dropdown: `Recruiter` (default) | `Client (<client name>)` — client name resolved from `process.application.position.client.name`.
3. **Interview list rows** (`src/routes/interviews.tsx`, `src/routes/client.interviews.tsx`, process detail rows):
   - Render the round label as `custom_kind_label ?? INTERVIEW_KIND_LABEL[kind]`.
   - Show a small badge: `Recruiter` or `Client` next to the interviewer line.

## Out of scope

- Per-client templates (we chose global library).
- Picking a specific named person beyond Recruiter/Client.
- Notifications/calendar logic changes — only the label + badge change in this pass.
