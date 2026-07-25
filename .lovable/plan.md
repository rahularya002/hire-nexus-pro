## Email Candidate Intelligence (Gmail, per recruiter)

Turn each recruiter's Gmail history into a **separate** searchable talent archive. It lives in its own section — the existing candidate database is untouched. Only emails carrying a resume/CV are imported.

### 1. Connect the mailbox (reuse existing Google connection)

The app already has per-recruiter Google OAuth with refresh tokens (used for Calendar). Extend it:
- Add read-only Gmail permission to the consent screen; existing users get a "Reconnect to enable email import" prompt.
- An **Email import** card in Settings shows connection state, last scan, and counts.

### 2. New section: "Email Archive"

A new nav entry with three views:
- **Import** — setup + live progress
- **Candidates** — the archive of people discovered from email
- **Profile** — one archived person with their full email/resume history

Nothing here writes into the main candidate database. A per-record **"Add to candidate database"** action exists so a recruiter can promote someone deliberately (and only then).

### 3. Import setup

Before scanning, the recruiter picks:
- Date range (6 / 12 / 24 months, or custom)
- Gmail labels/folders to include (fetched live from their mailbox)
- Optional sender/domain exclusions

### 4. Scan + extract (background, resumable)

Only messages with a PDF/DOC/DOCX attachment in the chosen range/labels are processed. For each:
1. Store the resume file in the private `documents` bucket.
2. Extract text with the existing PDF/DOCX parser.
3. AI-extract name, email, phone, location, experience, salary, skills.
4. Attach the email (subject, snippet, date, direction, participants) as a timeline event.

Runs in batches with progress persisted, so it survives refreshes and can be paused/resumed.

### 5. Progress screen

Live counts: emails scanned, resume emails found, people discovered, records enriched, duplicates merged, failures — plus a running list of newly found people and a review-failures list.

### 6. Dedup (within the archive only)

Auto-merge on matching email or phone **inside the archive**. Same person across many emails = one archive record with multiple resume versions and a longer timeline. Name-only matches stay separate.

### 7. Archived-person profile

Newest-first history:
- Resume versions (date, source email, download, "latest" marker)
- Email interactions (subject, date, recruiter, direction)
- Detected client/company mentions from the thread

Answers "have we worked with them before", "who talked to them", "when was the resume last updated", "how many resume versions".

### 8. Search

Full-text search across resume text and email subjects/snippets, plus filters for skills, location, last-contacted date, and recruiter. Searching "python" returns everyone whose imported CV or email history mentions it, with a match-source chip and one-click CV open.

### 9. Keeping it current

After the backfill, a lightweight periodic check picks up new resume-bearing emails and appends to the same archive records automatically.

### Out of scope
- Outlook mailboxes
- Emails without attachments
- Any automatic write into the main candidate database

---

### Technical notes

- **Auth**: add `gmail.readonly` to the existing Google OAuth scope string; reuse `google_calendar_connections` and prompt re-consent when stored scopes lack Gmail.
- **New tables** (all separate from `candidates`, agency/user scoped, RLS + GRANTs): `email_import_runs` (status, range, labels, counters, cursor), `email_messages` (gmail message/thread id, subject, participants, date, archive_person_id, unique per user+message), `email_candidates` (the archive record: name, email, phone, location, skills, last_seen_at, promoted_candidate_id), `email_resume_versions` (archive_person_id, storage path, source message, extracted text).
- **Server fns** in `src/lib/email-import.functions.ts`: `listGmailLabels`, `startImportRun`, `processImportBatch` (~20 messages/batch, looped from the client to stay within Worker limits), `getImportProgress`, `cancelImportRun`, `promoteToCandidate`.
- **Extraction** reuses `src/lib/cv-parse.server.ts` and the existing CV-import AI prompt.
- **Search**: Postgres full-text index over resume text + email subjects, scoped to the archive tables.
