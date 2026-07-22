## Goal

On the Candidate Database page, let users drag one or many CV files (PDF / DOC / DOCX / TXT) anywhere on the page. Each file is uploaded to storage, parsed, sent through the Lovable AI gateway to extract structured fields, and inserted as a new candidate with the CV attached.

## UX

- Wrap the page in a drop zone. On dragenter, show a full-page overlay: "Drop CVs to import — we'll extract details automatically". Also add a visible "Upload CVs" button (multi-file picker) next to "Bulk import" as a discoverable entry point.
- On drop, open a modal "Importing CVs" showing a row per file with status: Uploading → Parsing → Extracting → Saved / Failed (with error text). Each row shows the extracted name once known.
- On close, refresh the candidate list. Successful count + failed count toast.
- Duplicates (matching email/phone) are surfaced as "Skipped — duplicate of X".

## Backend

New server function `importCandidateFromCv` in `src/lib/candidates.functions.ts`:

1. Accept `{ storagePath, fileName, mime, sizeBytes }` (client uploads first via existing `uploadCvFile`).
2. Download the file from the `documents` bucket using the authenticated supabase client.
3. Extract raw text:
   - PDF → use `unpdf` (`extractText`) — Worker-compatible, pure JS.
   - DOCX → use `mammoth` (`extractRawText`) — pure JS.
   - DOC (legacy) → not reliably parseable in Workers; return a friendly error asking the user to convert to DOCX/PDF.
   - TXT → decode UTF-8.
4. Send the first ~15k chars to Lovable AI gateway (`google/gemini-2.5-flash`) with a tool-call schema mirroring `candidateSchema` fields: `name, email, phone, role, current_company, experience, location, linkedin_url, skills[], salary, salary_min, salary_max, notes` (summary).
5. Duplicate check on normalized email/phone — if hit, return `{ status: "duplicate", candidateId, name }` without inserting.
6. Insert candidate with `source: "database"`, `resume_url: storagePath`, extracted fields.
7. Also insert a `documents` row (`kind: "resume"`, linked to candidate) so the CV shows up in the docs listing (mirrors the pattern already in `EditCandidateDialog`).
8. Return `{ status: "created", candidate }`.

Reuse the extraction pattern from `src/lib/jd-extract.functions.ts` (tool-call with strict schema, null fallback).

## Frontend

- New component `src/components/cv-drop-import.tsx` that renders the overlay + progress modal and exposes `<CvDropImport onDone={refresh}>{children}</CvDropImport>` wrapping the page content.
- Client flow per file: `uploadCvFile(f)` → `importCandidateFromCv({ storagePath, fileName, mime, size })` → update row state.
- Integrate into `src/routes/database.tsx`: wrap the page, add "Upload CVs" button that opens a hidden multi-file input which feeds the same handler.

## Dependencies

Install: `unpdf`, `mammoth` (both Worker-compatible ESM libraries).

## Files

- Modify: `src/lib/candidates.functions.ts` (add `importCandidateFromCv` + helper `parseCvText` in a new `src/lib/cv-parse.server.ts` to keep the server function module lean).
- Add: `src/lib/cv-parse.server.ts` (PDF/DOCX/TXT text extraction).
- Add: `src/components/cv-drop-import.tsx`.
- Modify: `src/routes/database.tsx` (wrap in drop zone, add "Upload CVs" button, invalidate `["candidates"]` on done).
- `package.json` via `bun add unpdf mammoth`.

## Edge cases

- File > 10 MB or unsupported extension → reject before upload (reuse `uploadCvFile` guards).
- Empty/garbled text extraction (<40 chars) → skip AI call, insert candidate with only `name = fileName` and CV attached, status "Partial".
- AI returns no name → fall back to filename stem.
- All storage uploads use existing private `documents` bucket; access via `getResumeSignedUrl`.
