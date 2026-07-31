## Problem

Runs already store `date_from` / `date_to`, and the engine skips any Gmail message it has seen before (checked by message ID against `email_messages` and `email_import_skips` before fetching the body or calling AI). So re-running never re-imports or re-pays for AI on old mail — but the UI never tells you which window you already recovered, and a repeat "Entire mailbox" run still walks all message IDs again, which is slow for no gain.

## What to build (frontend only, no backend/schema changes)

### 1. Coverage summary
Derive coverage in the page from the existing run history (`listImportRuns`, which already returns `date_from`, `date_to`, `status`, `created_at`, `google_email`):
- earliest `date_from` across completed/paused runs (null = entire mailbox)
- most recent `date_to` / `finished_at` (the "recovered through" point)

Show it as a single line in the recovery panel and header, e.g.
`Recovered: Mar 2023 → today · last run 4 days ago · 1,284 emails scanned`
and, when a run covered the whole mailbox, `Entire mailbox recovered`.

### 2. Mark the window cards
In the idle-state window picker (`recovery-panel.tsx`):
- Cards fully inside existing coverage get a subtle "Already recovered" tag and a muted style, with helper text: "Re-running is safe — already-processed emails are skipped."
- Cards that extend beyond coverage show what's new: "Adds ~2 years of older history".

### 3. New default: incremental catch-up
Add a first option above the windows when coverage exists:
**"New mail since last recovery"** — starts a run with `dateFrom` = last coverage end. This is the recommended action for a mailbox already recovered, and is the fast path (Gmail only enumerates recent mail rather than everything).

### 4. History sheet clarity
In `history-sheet.tsx`, show each run's window explicitly (`From … to …` / `Entire mailbox`) and add a "duplicates skipped" line using the existing `duplicates_merged` field so repeat runs visibly explain themselves.

## Technical notes
- All values come from the existing `listImportRuns` server function; no migration and no changes to `email-import.server.ts`.
- Files touched: `src/routes/email-archive.tsx`, `src/components/email-archive/recovery-panel.tsx`, `src/components/email-archive/history-sheet.tsx`.
