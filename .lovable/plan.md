# Fix "Clear archive"

## What's wrong

Clearing the archive currently tries to delete ~4,800 archive people by listing every
single row ID in one request. That request is far too large for the database API, so it
fails (or silently does nothing) and the archive stays where it was. Related email and
resume records are also only cleaned up for people in that same oversized list, so
leftovers remain even when part of the delete succeeds.

Current data in your account: 4,775 archive people, 9,330 stored emails, 14,122 resume
versions, 24,090 skipped items, 9 runs still counted as live.

## What to change

- Delete by owner instead of by ID list: remove this recruiter's archive rows directly,
  in safe chunks, looping until nothing is left — no more giant single request.
- Keep the existing rule that people already promoted to the candidate database stay:
  their archive row is preserved, everything else is removed.
- Clean up the stored emails and resume versions belonging to removed people (including
  orphans left behind by earlier failed clears).
- Keep the current behaviour of cancelling any live import and stamping all runs as
  cleared, so the dashboard resets to the idle state and history is preserved.
- Report the real number removed back to the UI so the toast reflects what happened, and
  surface a clear error instead of a silent no-op if a step fails.

## Technical notes

In `src/lib/email-import.functions.ts` → `clearEmailArchive`:

- Replace the `select(...).limit(5000)` + `.in("id", doomed)` pattern with chunked
  deletes scoped by `user_id` (and `agency_id` where present), paging in batches of
  ~500 IDs until the unpromoted set is empty.
- Delete order stays child-first: `email_resume_versions` → `email_messages` →
  `email_candidates`, each scoped to the same user and chunk.
- Keep `email_import_skips` cleanup, the `cancelled` update for running/paused runs,
  and the `cleared_at` stamp on all runs.
- No schema change, no UI change beyond the existing toast text.
