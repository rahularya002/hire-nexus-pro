## What's wrong today

The import pipeline decides "is this a candidate?" almost entirely from the attachment. Verified in the current code:

- `buildQuery` (src/lib/gmail.server.ts) searches `has:attachment (filename:pdf OR doc OR docx)` plus a fixed blocklist of noisy senders — anything not on the blocklist gets in.
- `processRunBatch` (src/lib/email-import.server.ts) gates on filename regexes, then `textLooksLikeResume` (length ≥ 400 + 2 section words), then a single AI `is_resume` boolean. It never looks at the email body, the recipient, or the thread.
- The outcome is binary: a person row is created, or the message is silently counted in `skipped_non_resume`. There is nothing to review, and no score anywhere — `email_candidates` has no confidence/status column today.

So a Paytm/NSE statement whose PDF happens to contain "portfolio", "balance", "career" style words can still pass, and a genuine recruiter forward with a weirdly-named attachment can be silently dropped with no trace.

## The new model: score, then act

Every message gets a **recruitment confidence score (0–100)** built from many signals, then routed by threshold:

```text
score >= 80   ->  imported      "94% Recruitment Email  ✓"
45 - 79       ->  needs review  "61% Recruitment Email  Needs review"
< 45          ->  skipped       "12% Recruitment Email  Skipped"   (kept as an audit row, no candidate)
```

Nothing below 80 ever creates a candidate record automatically.

### Signals used (new `src/lib/recruitment-classify.server.ts`)

Cheap heuristics first (no AI cost), producing a pre-score plus a hard-block for obvious noise:

- **Sender**: automated local parts / known transactional domains (existing regexes) vs. job-board and ATS domains (naukri, linkedin, indeed, monster, hirist, cutshort, instahyre, workday, greenhouse, lever, zoho recruit) and free-mail senders writing personally.
- **Recipient**: message addressed *to* the recruiter's own mailbox vs. bulk/undisclosed recipients.
- **Subject**: recruitment vocabulary (resume, cv, profile, candidate, applying, application for, interview, shortlist, JD, notice period, CTC, opening, position) vs. transactional vocabulary (statement, invoice, receipt, OTP, order, ticket, itinerary, tax, bill).
- **Body text**: new `getBodyText()` helper in gmail.server.ts to decode `text/plain` / stripped `text/html` parts — currently the body is never read at all. Scored for candidate-submission phrasing, contact blocks, notice period / CTC / experience mentions.
- **Attachment names**: existing resume vs. noise filename regexes, plus `Firstname_Lastname` shape.
- **Thread context**: if the Gmail thread already produced an archived person for this user, the thread is treated as recruitment (recruiter↔candidate conversations, interview scheduling, follow-ups).
- **Document text**: extracted CV text — section markers, contact details, chronology of employers/dates.

Then a single AI pass (Lovable AI, Gemini 2.5 Flash) receives the *whole context* — sender, recipients, subject, body excerpt, attachment filenames, thread hint, and the document excerpt — and returns via tool call:

- `is_recruitment` (boolean)
- `confidence` (0–100)
- `email_kind` (`candidate_submission` | `resume_forward` | `job_application` | `interview_scheduling` | `recruiter_conversation` | `job_alert` | `bank_statement` | `invoice_receipt` | `travel` | `order_shipping` | `newsletter_promo` | `otp_security` | `other`)
- `reason` (one short sentence)
- plus the existing candidate fields (name, email, phone, role, company, experience, location, salary, skills, notes)

Final score = AI confidence adjusted by the heuristic pre-score (heuristic hard-blocks cap the score, strong heuristic evidence lifts a borderline AI answer). `email_kind` in any non-recruitment category caps the score below the skip threshold regardless of what the AI says about confidence.

### Scope change so non-attachment recruitment mail is seen

The Gmail query becomes a union: attachment-bearing mail **or** mail matching recruitment keywords without an attachment. Attachment-free recruitment mail (interview scheduling, recruiter replies) never creates a person — it is only appended to the timeline of a person already in the archive from the same thread or sender. This gives real conversation history without opening a new false-positive path.

## Review queue and audit trail

- `email_candidates` gains `confidence`, `review_status` (`imported` | `needs_review` | `rejected`), `email_kind`, `classification_reason`, `signals` (jsonb).
- New `email_import_skips` table stores every non-imported decision: gmail message id + thread id, sender, subject, snippet, attachment names, score, kind, reason, and its own status (`needs_review` | `skipped` | `rescued`). Review-band messages store their extracted fields as a pending payload so approval is one click and needs no re-download.
- The archive list gets tabs: **People** (imported), **Needs review** (45–79 band), **Skipped** (audit log, searchable, with a "This is a candidate" rescue action that converts the pending payload into a person).
- Existing `listEmailCandidates` filters to `review_status = 'imported'` so today's People view stays clean.

## UI: confidence everywhere

- Each card and each review row shows the score chip in place of the current plain badge: `94% Recruitment Email ✓` (green), `61% Recruitment Email · Needs review` (amber), `12% Recruitment Email · Skipped` (muted), with the AI's one-line reason as tooltip/subtext.
- Import progress tiles become: Emails scanned · Imported · Needs review · Skipped · Duplicates merged · Failures, with the review tile linking to the review tab.
- The detail sheet shows the classification block (score, kind, reason, top signals) above the timeline.

## Backfill for existing rows

The **Remove non-candidates** button becomes **Re-score archive**: it re-runs the classifier over existing `email_candidates` using stored resume text, subject and sender, writes a confidence to each, moves the 45–79 band to Needs review and the <45 band to Rejected (kept, not deleted, so nothing is lost by mistake), with a separate explicit "Delete rejected" action.

## Technical notes

- New file: `src/lib/recruitment-classify.server.ts` (heuristic signal scoring + AI classification call + score fusion + thresholds).
- `src/lib/gmail.server.ts`: add `getBodyText()`, recruitment-positive sender/subject vocabularies, keyword branch in `buildQuery`, keep existing noise regexes as signal inputs rather than hard gates.
- `src/lib/email-import.server.ts`: replace the three hard gates with one classify-then-route step; write imported / review / skip rows accordingly; keep dedup, storage upload and resume-version logic unchanged.
- `src/lib/email-import.functions.ts`: `listReviewItems`, `approveReviewItem`, `rejectReviewItem`, `rescoreArchive`, `deleteRejected`; progress type extended.
- `src/routes/email-archive.tsx`: tabs, confidence chips, review actions, updated tiles.
- One migration: new columns on `email_candidates`, `needs_review`/`skipped` counters on `email_import_runs`, and the `email_import_skips` table with GRANTs and agency-scoped RLS matching the existing archive tables.
