Update the candidate card in the agency position detail view (`src/routes/positions.$positionId.tsx`) so that:

1. **Edit button moves to the top-right** of each candidate card, aligned with the candidate name/stage and match score.
2. **AI Screen button moves to the bottom-left** of the action row, appearing as the first action before CV and LinkedIn.
3. **Add a hover tooltip** on the AI Screen button that reads `"automated ai call"`.

No database or server-function changes are needed; this is a pure UI/layout update in the candidate row component.