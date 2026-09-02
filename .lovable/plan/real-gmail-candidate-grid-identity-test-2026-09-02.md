# Real Gmail → Candidate Grid identity test

The connected mailbox is reachable from this runtime: a live Google connection exists for `gitu@placemewell.com` with the `gmail.readonly` scope and a valid refresh token, so the real end-to-end test can be executed (no simulation needed).

## What the test will do

Run the existing one-off diagnostic (`scripts/e2e-real-mail.ts`, narrowed to a single message) against that mailbox, exercising the exact production path:

1. Gmail discovery — list messages with `has:attachment`, pick the first one whose attachment is a real CV.
2. Download the actual attachment bytes through the app's own Gmail helper.
3. Extract CV text (PDF line reconstruction / DOCX).
4. Extract candidate name, email, phone, designation deterministically.
5. Build the candidate row through the same grid adapter the UI uses.
6. Run the query `Fashion designers with 3+ years experience in Delhi or Mumbai` against that row and confirm the outcome follows the candidate's real role.

Per step it records PASS/FAIL. Sender name/email is captured only to assert it is NOT reused as candidate identity. Nothing is written to the database; the run is read-only against Gmail.

## Report you get back

- Real recruitment email with a resume found: PASS/FAIL
- Attachment downloaded: PASS/FAIL
- CV text extraction: PASS/FAIL (character count only)
- Candidate name detected from CV: PASS/FAIL
- Grid row name equals CV-derived name: PASS/FAIL
- Sender/recruiter name leaked as candidate name: must be FAIL-if-present
- Candidate email/phone sourced from CV content, not sender: PASS/FAIL
- File/function responsible for each step
- If any step fails: the first point in the pipeline where identity is lost

No full email addresses, phone numbers, or resume contents in the report — values are masked, and only match/mismatch verdicts are stated.

## Technical notes

- Path under test: `src/lib/gmail.server.ts` (list/get/attachment) → `src/lib/gmail-discovery.server.ts` (`gmailMessageToRawItem`) → `src/lib/candidate-attachment.ts` (`pickPrimaryCandidateAttachment`) → `src/lib/cv-parse.server.ts` (`extractCvText`) → `src/lib/cv-name.ts` + `src/lib/pipeline/normalize.server.ts` (`extractDeterministic`) → `src/lib/pipeline/classify.server.ts` → `src/lib/mailbox-grid.server.ts` (`hydrateCandidatePage`) → grid row in `src/components/email-archive/mailbox-panel.tsx`.
- The test script runs with the diagnostic user id for the `gitu@placemewell.com` connection and uses `getValidAccessToken` so token refresh matches production.
- No code changes unless the run proves a defect. If it does, the fix is scoped to the failing identity/extraction step only (no new LLM call for name extraction), then the same real run is repeated, followed by the search test suite, typecheck, and build.
