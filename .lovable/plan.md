## Goal

Stop asking "is this a recruitment email?" and start asking "does this email contain a candidate we can import?". Recruiter chatter, JDs and interview feedback stay in the archive as logged context, but never land in the recruiter's review queue.

## Artifact model

Every scanned email is labelled with one primary artifact:

```text
candidate_profile          -> import / review as candidate
candidate_plus_conversation-> import candidate, keep the mail in history
recruitment_conversation   -> logged as recruitment memory, no candidate
job_description            -> logged as requirement intelligence, no candidate
interview_feedback         -> logged, no candidate
administrative             -> skipped
```

Non-candidate artifacts are stored lightweight, in the existing skip/log table, with the artifact label and a browsable tab — no new tables.

## Candidate evidence (deterministic, before any AI)

- Resume-style attachment (.pdf/.doc/.docx) with a filename hit on resume / cv / profile / candidate / biodata, or a person-shaped filename
- Attachment text that parses as a resume (2+ resume sections, contact block)
- Body phrases: "please find attached", "attached is the candidate", "sharing profile", "kindly find the resume", "candidate details"
- Resume-shaped body text (contact block + experience/education headings) when there is no attachment
- Negative evidence: JD phrasing ("we are hiring", "job description", "openings", "share profiles for"), interview feedback phrasing, pure conversation with no contact block

## Scoring and routing

`confidence` becomes **candidate confidence** — how sure we are an importable candidate profile exists.

- Strong candidate evidence, deterministic identity present -> auto-import, no AI call
- Zero candidate evidence but clear recruitment wording -> artifact is conversation / JD / feedback, logged, `skipped` status, **never** review
- Clear administrative or transactional -> skipped (existing hard blocks stay)
- Genuinely uncertain only -> AI call, then review queue

Review queue is reserved for: resume pasted in the body, unreadable/scanned PDF, mixed attachment types, corrupted document, or attachment parsed but identity ambiguous.

## Technical changes

1. **Migration** — add `artifact_type text` to `email_candidates` and `email_import_skips` (nullable, default null); add an index on `email_import_skips(user_id, artifact_type)`. Backfill runs via re-score, not SQL.
2. **`src/lib/recruitment-classify.server.ts`** — split `heuristicScore` into two scores: `recruitmentScore` (kept for noise rejection) and a new `candidateEvidence` (0–100 plus hit list, driven by the evidence rules above). Add JD / feedback / conversation detectors.
3. **`src/lib/pipeline/classify.server.ts`** — AI tool schema swaps `is_recruitment`/`confidence` for `artifact_type` + `candidate_confidence` + `reason`; prompt is rewritten to pick the primary artifact. Fusion logic routes on artifact, not on recruitment score. AI is only called in the uncertain band, same cost architecture.
4. **`src/lib/pipeline/config.ts`** — thresholds renamed to candidate-confidence bands (`CANDIDATE_IMPORT_THRESHOLD`, `CANDIDATE_SKIP_THRESHOLD`), still env-tunable.
5. **`src/lib/email-import.server.ts`** — persist `artifact_type` on both people and skip rows; the "recruitment mail with no attachment" branch no longer defaults to review — it becomes a logged conversation unless resume-in-body evidence exists.
6. **`src/lib/email-import.functions.ts`** — return `artifact_type` from the archive/review queries; rewrite `rescoreImpl` to re-classify existing rows under the new model and re-route them (conversations/JDs move out of the candidate list into the logged tab; nothing is deleted; promoted people are never demoted).
7. **`src/routes/email-archive.tsx`** — replace `ConfidenceBadge` with an outcome chip:
   - `Candidate detected — ready to import` (green, with % candidate confidence)
   - `Candidate + conversation`
   - `Recruitment conversation — stored in archive`
   - `Job description — stored as requirement`
   - `No candidate found`
   Review tab shows only genuine uncertainty with the specific reason ("resume looks pasted in the body", "attachment could not be read"). Add an artifact filter to the archive tab, and a "Recruitment context" tab listing logged conversations/JDs/feedback (read-only, with a promote-to-candidate escape hatch).

## Rollout

After the migration, the existing "Re-score archive" button applies the new model to everything already imported, so the current false-positive rows (Paytm, NSE etc.) get relabelled as administrative and the recruiter conversations drop out of the review queue.
