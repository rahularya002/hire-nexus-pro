
# Email Archive → Recruitment Memory

Rebuild `/email-archive` as a workflow-first, premium recruiter experience. Classification logic, dedup and the import engine stay exactly as they are — this is a UI/UX rebuild plus a few thin lifecycle server functions that the requested controls need.

## 1. Page frame

- Header becomes a product story, not a utility label: **Recruitment Memory** with a one-line subtitle ("Recover years of candidate knowledge from your inbox and search it like a database"). Small connected-mailbox chip (Gmail address + green dot) replaces buried connection text.
- Right side of header holds a single overflow menu (`⋯ Manage`) instead of loose buttons: Re-run recovery, Pause/Resume, Stop current run, Re-score archive, Clear archive, Disconnect Gmail, View import history.
- Wider, calmer layout: consistent card component, more whitespace, one accent colour, fewer borders, no double-nested boxes.

## 2. Recovery panel — four distinct states

Single card that switches shape based on run status.

**Idle / never run**
- Value framing: what Recruitment Memory does in three short lines with icons (scan history → detect candidate profiles → searchable archive).
- Primary CTA: **Recover Recruitment Memory**.
- Timeframe as four selectable tiles instead of a dropdown: Last 3 months, Last 12 months, Last 3 years, Entire mailbox (Recommended badge). "Entire mailbox" sends no `dateFrom`.
- Estimated impact strip under the tiles, computed client-side from the chosen window (emails to scan, likely candidate profiles, rough duration), clearly labelled as an estimate.
- **Advanced options** collapsed by default: label/folder picker and excluded senders/domains. Closed state shows a one-line summary ("All folders · no exclusions").

**Running**
- Live progress: indeterminate-to-proportional bar, elapsed timer, and a metric row: emails scanned, candidates recovered, conversations, job descriptions, needs review.
- Controls: Pause, Resume, Stop. Technical counters (AI calls, cache hits, rules-decided) move behind a small "Processing details" disclosure.

**Paused**
- Muted state with Resume as primary, Stop secondary, progress preserved.

**Completed**
- Success card with summary lines (emails scanned, candidates recovered, conversations, job descriptions, items needing review) and CTAs: **Browse recovered candidates** (scrolls/filters to list), **Review N items** if any, **Recover more** (returns to idle setup).

## 3. Statistics

Replace People / Resumes / Added to DB with a 5-tile row driven by existing data: Recovered candidates, Added to database, Needs review, Recruitment conversations, Last sync (relative time). Tiles are quiet — number, label, subtle icon — and clickable where they map to a filter.

## 4. Navigation

Tabs renamed to recruiter language, with counts:
- **Candidates** (was Archive)
- **Needs your call** (was Needs Review)
- **Recruiting history** (was Recruitment Context)
- **No candidate found** (was Skipped)

## 5. Search experience

- One prominent search field with knowledge-base phrasing ("Search by name, company, skill, email, phone or anything in a resume") — it already searches the resume/search blob.
- Rigid Skill / Location inputs become **filter chips**: click "+ Filter" → skill, location, contacted in 90 days, added to database, outcome type. Active filters render as removable chips under the field; the two selects collapse into that chip set.
- Result count line ("184 candidates recovered · 12 added to your database").

## 6. Candidate cards

Restructured hierarchy: avatar + name + role @ company on line one; location · experience · salary as a single muted meta line; up to four skill chips; footer line answers "where did we find them" (last email date, resume count, inbound/outbound source). Outcome chip only shown when it carries information (needs review / no candidate), not on every healthy card. AI summary shown in the detail sheet only, never truncated on the card.

## 7. Empty states

Purposeful copy for each: not connected, connected but nothing recovered yet, no search results (with "clear filters"), nothing to review, no recruiting history, nothing skipped.

## Technical notes

- Frontend work is confined to `src/routes/email-archive.tsx`, split into small local components (`RecoveryPanel`, `RunStats`, `FilterChips`, `PersonCard`, plus the existing `PersonSheet`).
- New thin server functions in `src/lib/email-import.functions.ts` (required by the requested controls, no engine changes):
  - `stopImportRun` — sets status `cancelled` + `finished_at`.
  - `listImportRuns` — last ~20 runs for the history drawer.
  - `clearEmailArchive` — deletes this user's archive rows (people, messages, resume versions, skips) behind a typed confirmation.
  - Disconnect Gmail reuses the existing Google connection disconnect function if present; otherwise a small `disconnectGoogle` equivalent is added.
- "Entire mailbox" simply omits `dateFrom`; `startImportRun` already accepts a null date.
- Head metadata updated to the new naming.
