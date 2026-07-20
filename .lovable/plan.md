## Goal
Tag each candidate with a "source client" so bulk-imported (and manually added) candidates show which client they came from, and let users filter the database by that client.

## Schema
Migration on `public.candidates`:
- Add `source_client_id uuid null references public.clients(id) on delete set null`.
- Index on `(source_client_id)` for the filter query.
- No RLS change needed — existing agency-scoped policies already cover it.

## Server (`src/lib/candidates.functions.ts`)
- Extend `candidateSchema` with `source_client_id: z.string().uuid().nullable().optional()`.
- Extend `CandidateRow` type with `source_client_id: string | null` and an optional joined `source_client?: { id, name, color } | null`.
- Update `listCandidates` select to `*, source_client:clients!candidates_source_client_id_fkey(id,name,color)` and keep the existing order/limit.
- `createCandidate` / `updateCandidate` already spread `data`, so the new field flows through once the schema accepts it.

## Client-side add/edit
- `src/components/edit-candidate-dialog.tsx` and the "Add candidate" dialog inside `src/routes/database.tsx`: add a **Source client** select (searchable combobox using existing `listClients`) — optional, defaults to none.

## Bulk import (candidates)
- In `src/routes/database.tsx` bulk import flow:
  - Add a **Source client** picker above the file upload → applies to all rows in the sheet (bulk imports are typically per-client legacy data).
  - Also accept an optional `source_client_name` column in the template; if present and matches an existing client name (case-insensitive, scoped to the agency), it overrides the picker for that row. Unknown names surface as a row warning but don't block import.
  - Update the downloadable template + Instructions sheet accordingly.

## Bulk import (clients)
- `src/components/bulk-import-clients-dialog.tsx` / `bulkOnboardClients`: return the created `client_id` per row (already available server-side, just include it in the result). No candidate linkage here — the admin uses the candidate bulk importer next, picking the newly-created client from the dropdown.

## Table + filters (`src/routes/database.tsx`)
- New **Client** column in the table rendering a themed chip: colored dot (client.color) + client name, or a muted "—" when null. Chip is clickable → navigates to `/clients/$clientId`.
- New **Source client** filter in the filter bar: multi-select of the agency's clients, plus an "Unassigned" option. Combines with existing filters (location, salary, skills, etc.).

## Out of scope
- No backfill of existing candidates (source_client_id starts null; users can edit).
- No many-to-many tagging — one source client per candidate.
- No changes to how applications link candidates to clients; this is purely an origin tag.
- No client-portal exposure — clients don't see this field.

## Technical notes
- FK uses `on delete set null` so deleting a client doesn't cascade-delete candidate history.
- The `source_client` join uses an explicit constraint name to avoid PostgREST ambiguity with any other clients-referencing FK on candidates.
- Chip reuses the existing `client.color` convention from `positions.client` joins for visual consistency.
