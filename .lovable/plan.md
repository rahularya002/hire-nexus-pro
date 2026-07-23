## Plan

1. **Make the expanded candidate row responsive**
   - Replace the rigid `flex` row with a mobile-safe grid pattern: candidate details get `minmax(0, 1fr)`, actions stay in a fixed/right column on wider screens, and stack below on narrow widths.
   - Ensure every text container has `min-w-0` so names, roles, companies, and skill chips don’t push the card wider.

2. **Prevent action buttons from being cut**
   - Keep the CV / LinkedIn / Share buttons in a stable action area with enough width.
   - On narrower cards, move the action buttons into a horizontal wrap below the candidate details instead of forcing them off the right edge.

3. **Clean up styling while touching the row**
   - Replace the hardcoded LinkedIn blue classes with semantic/custom tokens in `src/styles.css` if needed, keeping the app theme consistent.
   - Keep the existing visual behavior and data unchanged.

4. **Verify in the live preview**
   - Recheck `/ongoing` for overflow/cut-off elements after the layout update.
   - Confirm the candidate row still shows CV, LinkedIn, and Share/Shared controls correctly.