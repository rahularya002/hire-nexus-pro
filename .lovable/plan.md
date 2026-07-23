## Fix action buttons overflowing on Ongoing mandates rows

On `/ongoing`, the right-side action column (CV / LinkedIn / Shared) on each scout candidate row visually pokes past the card edge, making the UI feel cut off (see uploaded screenshot).

### Root cause
In `src/routes/ongoing.tsx`, `CandidateRow` uses:
- Outer row: `flex items-start gap-3 ... p-3`
- Right column: `flex flex-col gap-1.5 shrink-0 w-28`

The buttons themselves also use `px-2.5` and the "Shared/Share" button has `whitespace-nowrap`. On tighter widths (and when the row lives inside the nested `px-4 py-4` scout panel), the fixed `w-28` column sits flush against the row edge with no breathing room, and the buttons appear to bleed into the outer position card's border.

### Change (single file: `src/routes/ongoing.tsx`)
Adjust only the action column in `CandidateRow` (lines ~301–336):

1. Widen and normalize the column so buttons don't feel clipped:
   - Change `w-28` → `w-[132px]` (fits "LinkedIn" and "Shared" comfortably).
   - Add `pr-0.5` to the column for a hair of trailing space.
2. Make each action button `w-full` (they already are via inline-flex + justify-center, but set `w-full` explicitly so they align regardless of label length) and keep `whitespace-nowrap` on all three so text can't wrap into a second line inside the button.
3. Add `min-w-0` to the row's flex-1 middle column (already present) — verify unchanged.
4. Keep everything else (icons, colors, semantics) intact.

No changes to data, server functions, styling tokens, or other routes.

### Verification
- Load `/ongoing`, expand a position with scout candidates.
- Confirm the CV / LinkedIn / Shared stack sits fully inside the candidate row card, with a small gap to the right edge, at both wide and ~1280px viewports.
