## Problem

Two things make the review tab unusable at 200 items:

1. **High-confidence items are still asked about.** An email can score 86% and still land in review — the pipeline only auto-imports when the score clears 75 *and* a name plus email/phone was extracted *and* no uncertainty flag was raised. So resumes where only the name was parsed, or attachment-free mails flagged "profile might be in the body", pile up even at 90%+.
2. **No triage.** The tab is a flat, date-sorted list of up to 200 rows with only per-item Import/Dismiss buttons. A recruiter can realistically clear 15–20.

## Plan

### 1. Stop sending trusted items to review
- Auto-import when confidence is high and a resume attachment exists, even if only a partial identity was parsed (name-only, or email-only from the sender address) — a resume is strong enough evidence to create a person; the recruiter can correct fields later in the person sheet.
- Keep review only for genuine "is there a candidate here at all?" cases: no resume attachment and unresolved body-profile uncertainty, or mid-band scores.
- Add a configurable **auto-accept threshold** (default 85) so anything at/above it with candidate evidence imports directly and gets marked as auto-accepted, visible in the archive rather than the queue.
- One-time "Apply new rules to queue" action: re-runs the routing decision over existing `needs_review` rows using their saved payload (no Gmail hits, no AI calls) and imports everything that now clears the bar. This is what drops 200 → a handful today.

### 2. Filters and quick triage in the tab
- Confidence-band chips: **Likely candidates (70%+)**, **Borderline (40–70%)**, **Weak (<40%)** with counts.
- Chips for **Has resume**, **Has phone/email**, **Only my inbox**, plus a date-range chip (last 3m / 12m / all).
- Free-text search over name, sender, subject, company, attachment name.
- Sort control: **Highest confidence first** (new default), Newest, Oldest.
- Artifact filter kept but collapsed under the existing filter row.

### 3. Bulk actions
- Checkbox selection per row, plus "select all filtered".
- Bulk **Import selected** and **Dismiss selected**, with a count in the button and a single undo-style toast.
- Keyboard triage: `J`/`K` to move, `A` to import, `X` to dismiss — clearing a queue by hand becomes seconds per item.

### 4. Make the queue finite
- Group the list by band with the strongest band expanded first, so the recruiter sees "12 likely candidates" before 180 weak ones.
- Header line: "Showing 12 of 204 — 180 weak items hidden" with a one-click reveal, plus a **Dismiss all weak items** escape hatch.
- Server query gains sort/limit/offset and band filtering so it stops silently truncating at 200; paginate at 50 with "Load more".

### 5. Empty / done state
- When the filtered queue is clear, show a "Queue clear" state with what was decided in this session and a link into Recovered candidates.

## Also suggested (included)

- Show *why* an item needs a call as a plain sentence chip ("No resume attached — profile may be in the body") instead of only the reason paragraph, so decisions don't need reading comprehension.
- Dedup within the queue: collapse multiple queue rows sharing a Gmail thread or the same resume hash into one decision.

## Technical notes

- `src/lib/pipeline/config.ts`: add `CANDIDATE_AUTO_ACCEPT_THRESHOLD` (default 85).
- `src/lib/pipeline/classify.server.ts`: relax the `hasPerson` requirement when an attachment-backed resume is present; add the auto-accept band.
- `src/lib/email-import.server.ts`: apply the same relaxation on the attachment-free path so only true uncertainty is reviewable.
- `src/lib/email-import.functions.ts`: extend `listReviewItems` with `search`, `band`, `hasResume`, `sort`, `limit`, `offset` and return a total count; add `bulkReviewDecision` and `retriageReviewQueue` (re-decides saved payloads, no Gmail/AI).
- `src/routes/email-archive.tsx` + a new `src/components/email-archive/review-queue.tsx`: filter chips, grouping, selection, bulk bar, keyboard shortcuts, pagination, empty state.
- No schema migration needed; existing `email_import_skips` columns (`confidence`, `artifact_type`, `pending_payload`, `attachment_names`) cover this.
