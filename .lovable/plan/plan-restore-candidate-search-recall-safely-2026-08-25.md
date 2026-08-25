# Plan: Restore Candidate Search Recall Safely

## Goal
Restore candidates for `Fashion designers with 3+ years experience in Delhi or Mumbai` without reopening the earlier false-positive issue where generic designer, Figma, location, or years qualified unrelated people.

## Changes
1. **Undo the over-restrictive occupation fallback**
   - Restore resume/body-text occupation evidence for ambiguous or missing role fields.
   - Keep explicit conflicting titles as hard negatives: UI/UX, Graphic, Product, Visual, Web Designer, Sales, Makeup Artist, Software Engineer.
   - Allow legitimate fashion variants: Fashion, Apparel, Clothing, Garment, Womenswear, Menswear, Textile/Fashion, Costume when fashion context exists.

2. **Separate compatibility from final scoring**
   - Keep occupation compatibility as the primary signal.
   - Incompatible occupations remain unqualified.
   - Ambiguous `Designer` can qualify only with strong fashion resume/body context and scores lower than explicit fashion titles.
   - Experience and location stay independent refiners in the score/missing/matched explanations.

3. **Preserve identity safety without blocking results**
   - Continue stripping sender identity from candidate name/email/phone.
   - Do not drop a result solely because the candidate name is missing.
   - Add tests proving recruiter names remain provenance only.

4. **Fix loading/search failure behavior only where needed**
   - Ensure active searches are labeled as progressive/loading, not final counts.
   - On search failure, keep the previous grid/search rows instead of replacing them with zero rows.

5. **Regression coverage and verification**
   - Add exact tests for the fashion query: positive fashion/apparel/womenswear results, lower-confidence ambiguous designer with strong fashion context, and exclusions for UI/UX/Graphic/Product/Sales/Makeup/Software.
   - Add/adjust grid status/session tests for progressive loading and failure retention.
   - Run targeted search tests and inspect build status before reporting completion.

## Root-cause check
The likely zero-recall regression is the latest occupation hardening that removed resume/body-text fallback evidence from `matchOccupation`, combined with `rankItem`/archive search dropping every result when `qualified` is false. I will verify this in tests and report the exact commit/change after the fix.
