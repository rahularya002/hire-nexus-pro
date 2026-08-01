## What's wrong

Your screenshot is a JD blast ("All Mandates", attachments literally named `Job Description - Manager Social.docx.pdf`) sitting at **100% Possible candidate**. I traced it in the scoring engine:

- `src/lib/recruitment-classify.server.ts` gives **+35 "attachment parses as a resume"** whenever the parsed document text has 3+ of: Skills, Education, Qualification, Experience, Projects. A job description contains all of those words — so JD PDFs score like resumes.
- There is no JD-aware filename rule. `Job Description - X.pdf` is only treated as a generic "document attached" (+12) — never as evidence *against* a candidate.
- The JD penalty is conditional: `if (jd && score < 40)`. Once the JD doc pushed the score above 40, the penalty is skipped entirely, so JD mails can only go up.
- Nothing distinguishes "one person" from "many roles". Mails listing multiple positions/budgets still route to a per-person review item.
- The queue has no volume ceiling, so a mailbox of JD threads becomes ~2k review items.

## The fix

**1. JD-aware evidence (`recruitment-classify.server.ts`)**
- Add a `JD_FILENAME` pattern (`job description`, `jd`, `requirement`, `mandate`, `role brief`, `hiring`, `openings`, `budget`). JD-named attachments are excluded from resume/person-named counts and add a negative signal.
- Add a `JD_DOC` pattern for the parsed document text (`roles and responsibilities`, `desired candidate profile`, `no. of positions`, `budget`, `we are looking for`, `job title:`, `experience required`). When the doc looks like a JD, the resume-section bonus is not awarded — a JD is not a resume just because it lists skills and qualifications.
- Make the JD and feedback penalties unconditional, and hard-cap candidate confidence (≈25) when JD signals dominate and no resume-named/person-named attachment or personal contact block exists.
- Add a "multiple roles listed" signal (several positions/CTC ranges/openings in one mail) that pushes the artifact to `job_description` instead of a candidate.

**2. Classifier prompt + fusion (`pipeline/classify.server.ts`)**
- Tell the model explicitly that a mail whose attachments are job descriptions is `job_description` with candidate_confidence near 0, even when the JD lists skills and experience.
- Refuse the rules-import band when JD signals are present and the only "resume" evidence is section counts — those go to `job_description` (stored as recruitment context, no human review).
- Stop labelling `recruitment_conversation` / `job_description` rows as "Possible candidate" in the outcome badge; they render as context, not a candidate call.

**3. Retroactive cleanup, no AI or Gmail cost (`email-import.functions.ts`)**
- Extend `retriageReviewQueue` to re-run the corrected deterministic evidence over each queued item's stored `pending_payload` (subject, body, attachment names, doc text already saved). Items that now read as JD / conversation / no-candidate are reclassified to recruitment context and leave the queue; items above auto-accept are imported as today. Report back: imported, moved to context, still needing a call.
- Same corrected pass reused by `rescoreArchive` so already-imported JD rows get demoted.

**4. Queue that a recruiter can actually clear (`components/email-archive/review-queue.tsx`)**
- Default the queue to items with a resume/person-named attachment and the "Likely" band, so the first screen is a short, high-yield list.
- Add an artifact filter chip row (Candidate profile / Candidate + conversation) and a "Hide job descriptions" toggle that is on by default.
- Add a "Today's triage" cap: show the top 25 by strength with a clear "25 of 1,842 — next 25" control, so the screen never presents 2k rows.
- Replace "Dismiss all weak" with "Clean up job descriptions (N)" plus the existing weak dismissal, and surface the re-triage result counts in the toast.

## Technical notes

No schema change. All work is in `src/lib/recruitment-classify.server.ts`, `src/lib/pipeline/classify.server.ts`, `src/lib/email-import.functions.ts`, `src/components/email-archive/review-queue.tsx`, and the badge helper in `src/components/email-archive/shared.tsx`. Reclassified items are moved to the recruitment-context store, never hard-deleted, and the review-status filter still lets you pull anything back.
