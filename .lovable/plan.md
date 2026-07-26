## Problem

The Gmail import treats **any email with a PDF/DOC attachment** as a candidate email. That's why bank/exchange alerts (Paytm statements, `nse_alerts@nse.co.in`, `info@bseindia.in`) land in the archive as "people", and why one card shows `null · null` — the AI extraction returned nothing, but the record was created anyway.

Three gaps cause this:

1. `findResumeAttachments` in `src/lib/gmail.server.ts` accepts every `.pdf/.docx/.doc/.txt` attachment with no filename or content check.
2. The Gmail query is only `has:attachment (filename:pdf OR doc OR docx)` — no sender exclusions for automated senders.
3. `processRunBatch` in `src/lib/email-import.server.ts` inserts a person even when extraction produces no name/email/skills, and writes literal `null` strings into the card.

## Fix: three-layer filter

**Layer 1 — Query-level exclusions (cheap, before download)**

Extend `buildQuery` with default noise exclusions applied on top of the user's own exclusion list:
- `-from:noreply -from:no-reply -from:donotreply -from:alerts -from:notifications -from:statements -from:billing -from:support`
- `-category:promotions -category:social -category:updates -label:spam`

Applied as defaults, still overridable by the run config.

**Layer 2 — Attachment + subject heuristics (no AI cost)**

Before spending an attachment download, score the message:
- Reject attachment filenames matching statement/invoice/report noise: `statement`, `invoice`, `receipt`, `bill`, `txn`, `transaction`, `policy`, `ticket`, `bank`, `contract note`, `holding`, `nse`, `bse`, `passbook`, `salary slip`, `payslip`.
- Boost filenames matching `resume`, `cv`, `curriculum`, `profile`, `naukri`, `linkedin`, or a `Firstname_Lastname` shape.
- Reject known automated sender domains/locals: `nse.co.in`, `bseindia`, `paytm`, `hdfcbank`, `icici`, `sbi`, `zerodha`, plus any local part in `alerts|noreply|no-reply|donotreply|statements|updates|info@`.
- Skip messages where the sender is a machine AND no filename resume signal exists.

**Layer 3 — Content gate before creating a person**

After text extraction, require the document to look like a resume before inserting:
- Text length ≥ ~400 chars, and at least 2 resume section markers (`experience`, `education`, `skills`, `projects`, `certification`, `objective`, `work history`, `employment`).
- Then run AI extraction with an added `is_resume` boolean field in the tool schema; the model explicitly classifies "is this a candidate resume/CV, not a statement/invoice/newsletter?".
- If `is_resume` is false, or the extraction produces no name **and** no email **and** no skills, record the message as scanned/skipped (increment a `skipped` counter) and **do not** create an `email_candidates` row or a resume version.

## Display cleanup

In `src/routes/email-archive.tsx`, stop rendering literal `null` — the company/role/location line should only render segments that have real values, and hide the whole line when all are empty.

## Cleanup of already-imported noise

Add a **"Remove non-candidates"** action on the Email Archive page (agency-scoped, admin-visible) that re-scores existing `email_candidates` rows against the same heuristics and deletes the ones that fail, along with their messages and resume versions. This lets you clear the Paytm/NSE/BSE rows already in the archive without a fresh import.

## Technical notes

- Files touched: `src/lib/gmail.server.ts` (query defaults, attachment scoring), `src/lib/email-import.server.ts` (content gate, `is_resume` in the AI tool schema, skip accounting), `src/lib/email-import.functions.ts` (cleanup server fn), `src/routes/email-archive.tsx` (null-safe rendering, cleanup button, skipped-count tile).
- Migration: add a `skipped_non_resume` integer column to `email_import_runs` so the progress panel can show "X skipped as non-resume".
- No change to dedup logic or the promotion-to-main-DB flow.
