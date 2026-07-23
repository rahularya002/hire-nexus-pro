## Problem

Bulk Excel import creates candidates with no CV attached. Excel can't carry files, so we need a second step: drop many CVs at once and attach each to the right candidate.

## Approach

Extend the existing drag-and-drop CV importer (`src/components/cv-drop-import.tsx`) with a new **"Attach mode"** that matches each dropped CV to an existing candidate instead of creating a new one. Trigger it from the Bulk Import dialog and from a new "Attach CVs" button next to "Upload CVs" on the Candidate Database.

### Matching strategy (per file)

For each CV, extract text once (reuse `extractCvText` + Gemini extraction already in `importCandidateFromCv`), then match against existing candidates in this order:

1. **Filename match** — normalized filename contains candidate's full name (or vice versa).
2. **Email match** — email parsed from CV equals candidate email.
3. **Phone match** — last 10 digits of parsed phone equal candidate phone.
4. **No match** → fall back to "create new candidate" (current behavior), tagged with the same `source_client_id` if set.

Ambiguous matches (2+ candidates hit) are skipped and surfaced in the results panel for manual resolution.

### Excel template change

Add an optional `cv_filename` column to the bulk-import template. If present, the matcher prefers exact filename match over heuristic name match — lets users guarantee correct pairing by naming files `john_doe.pdf` and putting `john_doe.pdf` in the row.

### UI

- New **"Attach CVs"** button on `src/routes/database.tsx` header, opens the same drop overlay in attach mode.
- Bulk Import dialog (`src/components/bulk-import-clients-dialog.tsx` sibling — create `src/components/bulk-import-candidates-dialog.tsx` or extend existing candidate bulk import in `database.tsx`) shows a **Step 2: Attach CVs** panel after the Excel import completes, pre-scoped to the just-imported candidate IDs.
- Progress modal shows per-file status: `Matched → {name}`, `Created new`, `Ambiguous — skipped`, `Duplicate`, `Failed`.

## Technical details

- New server fn `attachCvToCandidate(candidateId, storagePath, fileName, mime, sizeBytes)` in `src/lib/candidates.functions.ts`: uploads path already exists in `documents` bucket, updates `candidates.resume_url` (only if empty, else prompt overwrite), inserts a `documents` row with `kind: "resume"`.
- New server fn `matchCvToCandidates({ fileName, parsedEmail, parsedPhone, parsedName, scopeIds? })` returns `{ candidateId } | { ambiguous: string[] } | { none: true }`. Scoped to caller's agency via existing RLS.
- Client component change: `CvDropImport` gains a `mode: "create" | "attach" | "auto"` prop. In `auto` (default for the DB page), it tries attach-match first and falls back to create.
- Reuse existing upload flow (`src/lib/upload-cv.ts`) so files land in the `documents` bucket before the server call.
- No schema change required; `candidates.resume_url` and `documents` table already exist.

## Out of scope

- OCR for scanned PDFs (already limited by current parser).
- Bulk re-parse of CVs already attached.
