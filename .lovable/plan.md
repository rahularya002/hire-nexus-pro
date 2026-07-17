## Goal
Make `NumberInput` step increments context-aware so salary fields jump by meaningful amounts (e.g. 1 LPA) instead of 1 rupee, while other fields keep sensible defaults.

## Approach

### 1. Smarter default step in `NumberInput`
Add an optional `step` prop behavior:
- If `step` is explicitly passed → use it.
- Else infer from the current value magnitude:
  - `>= 1_00_000` → step `1_00_000` (1 LPA)
  - `>= 10_000` → step `10_000`
  - `>= 1_000` → step `1_000`
  - `>= 100` → step `10`
  - else → step `1`
- Keep clamping to `min`/`max` and empty-string handling intact.

Also add an optional `largeStep` (Shift+click) that multiplies step ×10 for power users.

### 2. Explicit steps at call sites where units are known
Pass explicit `step` so behavior is predictable, not just magnitude-based:
- `src/routes/database.tsx` salary min/max filters + form → `step={1}` (values are in LPA already, so 1 = 1 LPA)
- `src/components/edit-candidate-dialog.tsx` salary min/max → `step={1}` (LPA)
- `src/components/confirm-joining-dialog.tsx` CTC in INR → `step={100000}` (1 LPA)
- `src/components/edit-terms-dialog.tsx`:
  - fee percentage fields → `step={0.5}`
  - fee flat amount (INR) → `step={5000}`
  - days/cycle fields → `step={1}`
  - tax % → `step={0.5}`
- `src/routes/billing.clients.$clientId.tsx` billing days → `step={1}`
- `src/routes/superadmin.settings.tsx` interview duration (minutes) → `step={5}`
- `src/routes/superadmin.agencies.new.tsx` trial days → `step={1}`, MRR (INR) → `step={1000}`
- `src/routes/superadmin.agencies.$id.tsx` MRR (INR) → `step={1000}`
- Openings fields (`positions.tsx`, `client.upload.tsx`, `edit-position-dialog.tsx`) → `step={1}` (already default)

Behavior, validation, min/max unchanged — only the increment amount per click changes.

## Out of scope
- No schema/server changes.
- No visual redesign of the control itself.
