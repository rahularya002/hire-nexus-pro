## 1. Fix the "mini dashboard inside open requirements" bug

Root cause: `src/routes/positions.tsx` is the **parent** route for `/positions/$positionId` (TanStack flat naming). `positions.tsx` wraps its component in `<AppShell>`, and `positions.$positionId.tsx` also wraps **its** component in `<AppShell>`. When you click a row, both render → sidebar + topbar appear twice → it looks like a "mini dashboard" inside the page.

Fix: remove the `<AppShell>` wrapper from `positions.$positionId.tsx`. The parent already provides it via the `<Outlet />` branch of `PositionsShell`.

## 2. Better recruiter assignment UX (in position detail)

In `src/routes/positions.$positionId.tsx` → `AssignmentCard`, replace the bare native `<select>` with a clearer panel:

- Header row: avatar + "Assigned recruiter" + current name & role (or "Unassigned" pill).
- Admin/lead-only controls below:
  - shadcn `<Select>` with recruiter list (name · role).
  - Primary "Assign" / "Reassign" button (disabled until selection differs from current).
  - "Unassign" ghost button when someone is currently assigned.
- Saving state: button shows spinner + "Assigning…"; on success show inline ✓ "Assigned to {name}" badge for 3s and a toast; on failure show inline destructive message + toast.
- Invalidate `["position", id]`, `["positions"]`, `["dashboard"]` queries on success.

## 3. "Open in AI Scout" with the JD prefilled

After a recruiter is assigned (or any time, for admin/recruiters), show an action row on the position detail page:

- Button: **"Scout candidates with this JD"** → `Sparkles` icon, navigates to `/scout?positionId={id}`.

Wire `src/routes/scout.tsx` to read `positionId` from search params:

- Add `validateSearch` for `{ positionId?: string }`.
- On mount, if `positionId` is present, call `getPositionById` via `useServerFn` and seed the chat input with a structured brief (title, location, experience, salary, openings, skills, description) and attach it as a synthetic CV-style context block (`cv = { name: "{title} — JD", text: brief }`) so the existing send flow includes it. Clear the param from the URL after seeding (via `useNavigate({ replace: true })`) so it isn't re-applied on every render.

## 4. Client JD upload: auto-fill form from uploaded file

In `src/routes/client.upload.tsx`:

- When the user picks a file (PDF / DOCX / TXT), parse it client-side using the same approach already used in `src/routes/scout.tsx` (`pdfjs-dist` for PDF, `mammoth` for DOCX, `file.text()` for plain).
- Show a small "Reading JD…" state on the dropzone while parsing.
- Once text is extracted:
  - Always set `form.jd` to the extracted text (don't overwrite a non-empty existing value unless user confirms — keep it simple: only overwrite if `form.jd` is empty).
  - Run a lightweight regex/heuristic extractor to populate empty fields only (never overwrite values the user typed):
    - `jobTitle`: first non-empty line, or text after `Job Title:` / `Role:` / `Position:`.
    - `location`: after `Location:` / `Based in:` / common city keywords.
    - `experience`: regex `\d+\s*[-–]\s*\d+\s*(?:yrs|years)` or after `Experience:`.
    - `salary`: regex for `₹`, `INR`, `LPA`, `$`, `k` ranges, or after `Salary:` / `Compensation:` / `CTC:`.
    - `openings`: after `Openings:` / `Positions:` / `Vacancies:` digit.
    - `skills`: after `Skills:` / `Tech stack:` / `Requirements:` — take the next line, comma-split.
  - Show a subtle toast "Form auto-filled from JD — review and edit before submitting".
- Keep the manual form visible and editable (don't hide it) so the user can correct anything before submitting. This matches the user's intent ("auto fill … so we can submit the jd") while preserving editability.
- Extract the file-parsing helper into `src/lib/parse-jd.ts` so both `scout.tsx` and `client.upload.tsx` reuse it (no duplication).

## Technical Details

Files to change:

- `src/routes/positions.$positionId.tsx`
  - Remove `<AppShell>` wrapper from `Route.component`. Add "Scout candidates with this JD" CTA. Rewrite `AssignmentCard` with shadcn `Select`, explicit Assign / Reassign / Unassign buttons, and inline success state.
- `src/routes/scout.tsx`
  - Add `validateSearch` for optional `positionId`. On mount, if present, fetch position via `getPositionById` server fn and seed `cv` + clear URL param.
- `src/routes/client.upload.tsx`
  - On file select, call new `parseJdFile()` from `src/lib/parse-jd.ts`, populate `form.jd` (if empty) and any empty structured fields via heuristics. Show "Reading JD…" state.
- `src/lib/parse-jd.ts` (new)
  - `parseJdFile(file: File): Promise<string>` — moved from `scout.tsx`'s `handleFile`.
  - `extractFieldsFromJd(text: string): Partial<{ jobTitle; location; experience; salary; openings; skills }>` — pure regex/heuristic helper, fully unit-testable.
- `src/routes/scout.tsx` updated to import `parseJdFile` from the new helper.

No DB or server-function schema changes. No new dependencies (pdfjs-dist + mammoth are already installed). Behavior on `/positions` list page is unchanged. RLS is unaffected.
