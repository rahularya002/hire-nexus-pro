# Fix wrong data in the Candidate Grid

## What the data actually shows

I queried the stored candidate rows the grid reads. The problem is real and systemic, not cosmetic:

- 4,803 stored candidate rows. Names include values like `Arjitvideocon Gmail Dotcom`, `Venkatesh Siddavatam Years Bosh`, `Tilak Raj Managr`, `Vishwanath Hon Prod Suprt` — these are stitched from resume filenames and CV fragments, not real names.
- Role is empty on 3,446 of 4,803 rows (72%), yet Location is filled on 4,722 (98%) and Experience on 4,635 (96%). A city and a "N years" string are almost always found because the extractors scan the entire CV text plus the whole email body and take the first match anywhere — including recruiter tracker tables listing other people.
- 717 of 850 search hits come from these stored rows (`origin = archive`), so a search mostly replays old bad extractions rather than re-reading the email/CV.
- Search rows compute CTC and Notice Period from only the email subject plus snippet, so those two columns are near-always blank or wrong for search results even when the CV states them.

## Root causes

1. No candidate-scoped extraction. Role, experience, location, company and CTC are matched with global regexes over `docText + bodyText`. Any city, any "5 years", any "CTC: 12 LPA" in the message wins — even from an unrelated block.
2. Name extraction falls back to filename/token stitching too eagerly, producing non-name strings instead of honestly returning "Name not found".
3. Stale stored rows are trusted. Rows written by earlier, buggier versions are surfaced as-is with no re-verification and no marker of extraction version.
4. Search-row adapter has a weaker field source than the live grid path (subject+snippet vs CV text).

## The fix

### 1. Candidate-scoped field extraction
Extract role, experience, location, company, CTC and notice period from a bounded window around the candidate (CV header/summary section, or the candidate's own row when the mail is a tracker table), not from the whole blob. Fall back to "unknown" instead of the first global match. Location must come from the CV's contact/address area or an explicit label, not any city mentioned anywhere.

### 2. Honest name extraction
Tighten the filename/collapsed-token fallback so obvious non-names (email-derived tokens, role words, "Years", "Managr"-style fragments) are rejected and the row shows "Name not found". Never sender name.

### 3. Field-level provenance and confidence
Store, per field, where the value came from (cv_header, labelled_row, email_body, filename) and drop values whose provenance is untrusted for that field. The grid shows a value only when its source is acceptable.

### 4. Stop trusting stale rows
Stamp an extraction version on stored candidate rows. Rows below the current version are re-extracted from their stored CV text (or re-read from Gmail when needed) before being shown or scored, instead of being rendered from old fields.

### 5. Search rows use the same extraction as the grid
Make the search-hit adapter read CTC/notice/role/location from the candidate's CV text (already stored per resume version) via the same helpers the live grid uses, so search and grid never disagree.

### 6. Backfill
One pass to re-extract the existing 4,803 rows with the corrected logic and clear values that fail the new provenance rules, so the grid stops showing legacy garbage.

## Verification before I report done

- Sample 20 real rows from the live mailbox end-to-end and compare Name/Role/Experience/Location/CTC/Notice against the actual CV.
- Assert location and experience are no longer near-100% populated (they should be missing when the CV doesn't state them).
- Regression tests for: tracker-table emails (must not donate another person's city/years/CTC), scanned CVs (must yield "Name not found" rather than a stitched name), and search rows matching grid rows for the same candidate.
- Run search tests, typecheck, build.

## Technical notes

Files in scope: `src/lib/pipeline/normalize.server.ts` (scoped extraction), `src/lib/cv-name.ts` (name guardrails), `src/lib/candidate-row-extract.ts` (tracker-row scoping), `src/lib/mailbox-grid.ts` (search-row adapter, CTC/notice from CV text), `src/lib/mailbox-grid.server.ts` (provenance wiring), `src/lib/search/search.functions.ts` (re-verify stale archive hits), plus a migration adding an extraction-version column and the backfill.
