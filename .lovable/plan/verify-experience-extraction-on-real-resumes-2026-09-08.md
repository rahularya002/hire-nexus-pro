# Verify experience extraction on real resumes

Goal: confirm that a real resume containing a "Work Experience" section with employment date ranges (e.g. "2019 - 2023") reports the candidate's actual years of experience, and never a bogus "20 years" read out of a calendar year.

## What the check does

1. Read-only scan of the connected mailbox for messages with resume attachments (existing `scripts/e2e-one-resume.ts` path: Gmail -> download attachment -> CV text -> deterministic extraction -> grid row).
2. Add a small read-only variant that, for each real resume found, prints:
   - whether the CV text contains a Work Experience heading and a date range
   - the extracted experience value and its provenance (resume label vs. header vs. trusted body)
   - the surrounding CV snippet the value came from, masked of personal details
3. Keep going until at least one resume with an actual Work Experience date range is examined; report the outcome for each resume seen.

## Pass criteria

- No resume yields an experience value derived from a four-digit calendar year (no "19 years"/"20 years" from 2019/2020).
- Resumes with an explicit labelled duration ("Total Experience: 4 years") report that duration.
- Resumes with only date ranges and no explicit duration report no experience rather than a guess.

## Also run

- Full unit suite, typecheck, and a build.
- If the real-mail run exposes a case the current rules get wrong, fix `experienceFrom`/`normalizeYears` in `src/lib/candidate-fields.ts` and add a regression test built from the (anonymised) real text shape.

## Notes

- Output is masked: no candidate names, emails, or phone numbers are printed in full.
- Nothing is written to the database; the mailbox is read only.
