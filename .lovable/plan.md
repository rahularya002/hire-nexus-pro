## Goal
Replace the "recover / recovered / recovery" language in the Email Archive feature with "import / imported" so the workflow feels like candidate import rather than backup recovery.

## Scope
Only the Email Archive surface: `src/routes/email-archive.tsx` and the components under `src/components/email-archive/`.

## Changes

### User-facing copy
- Page title / meta: `Recruitment Memory — Recover Candidates from Gmail` → `Recruitment Memory — Import Candidates from Gmail`
- Tab label: `Recovered candidates` → `Imported candidates`
- KPI tile: `Recovered candidates` → `Imported candidates`
- Coverage labels:
  - `Entire mailbox recovered` → `Entire mailbox imported`
  - `History recovered` → `History imported`
  - `Recovered Mar 2023 → today` → `Imported Mar 2023 → today`
- Drawer trigger: `Recovery history` → `Import history`
- Drawer title/description and empty state updated to "import run" / "import your recruitment memory"
- Empty-state copy in the candidates tab updated to "Import your recruitment memory above…"
- Clear-archive dialog: `Clear the recovered archive?` → `Clear the imported archive?`; body copy updated to "imported archive" / "import your memory again"
- Toast messages: `Recovering your recruitment memory…` → `Importing your recruitment memory…`; `Could not start recovery` → `Could not start import`

### Recovery panel (`recovery-panel.tsx`)
- Section title: `Recover Recruitment Memory` → `Import Recruitment Memory`
- CTA button: `Recover Recruitment Memory` → `Import Recruitment Memory`
- Running state: `Recovering your recruitment memory` → `Importing your recruitment memory`; `Recovery paused` → `Import paused`
- Completed state heading: `Your recruitment memory is ready` stays; sub-actions:
  - `Browse recovered candidates` → `Browse imported candidates`
  - `Recover more history` → `Import more history`
- Intro card: `Recover the candidates you already know` → `Import the candidates you already know`
- Coverage summary strings:
  - `Entire mailbox already recovered` → `Entire mailbox already imported`
  - `Already recovered: <date> → <date>` → `Already imported: <date> → <date>`
  - `Last recovery finished <date>` → `Last import finished <date>`
- Time-window option: `New mail since last recovery` → `New mail since last import`
- Time-window card badge: `Recovered` → `Imported`
- Metric label: `Candidates recovered` → `Candidates imported`
- Helper text: `recovery runs in the background` → `import runs in the background`

### History sheet (`history-sheet.tsx`)
- Title: `Recovery history` → `Import history`
- Description and empty state updated to "import run" / "import your recruitment memory"
- Row metric: `<n> recovered` → `<n> imported`

### Review queue (`review-queue.tsx`)
- Empty-state helper: `Everything we recovered` → `Everything we imported`; `after your next recovery` → `after your next import`
- Error toast: `Re-run recovery instead` → `Re-run import instead`

### Code-level consistency (non-breaking)
- Rename internal variables/state keys in the route and panel so the code reads consistently: e.g., `recoveredThrough` → `importedThrough`, `recovered` count → `imported` count, `coverage.oldestFrom` comments updated.
- Keep component/file names (`RecoveryPanel`, `HistorySheet`) unchanged to avoid churn unless you want them renamed too.

## Out of scope
- Database column names or API field names (no migration needed; this is a copy-only change).
- The feature name "Recruitment Memory" remains as the product name.

## Verification
- Run a build/typecheck after edits.
- Visually confirm the Email Archive page no longer shows "recover/recovered/recovery" in any visible label, button, toast, or empty state.