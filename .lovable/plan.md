## Goal
Replace the browser's native number-input spinners (the little up/down arrows shown in the screenshot) with themed inline +/- controls that match the app's dark UI.

## Approach
Add a reusable `NumberInput` component and globally hide native spinners so any lingering `type="number"` fields also look clean.

### 1. Global CSS — hide native spinners
In `src/styles.css`, add a small utility to strip the WebKit/Firefox spinner chrome from `input[type="number"]` (and a `.no-spinner` utility) so no field ever shows the outdated arrows.

### 2. New component: `src/components/ui/number-input.tsx`
A drop-in wrapper around shadcn `Input` that:
- Renders a themed `−` button on the left and `+` button on the right (ghost/secondary, rounded, using `text-muted-foreground` + hover `bg-accent` — matches existing buttons).
- Uses `Minus` / `Plus` icons from `lucide-react`.
- Props: `value`, `onChange(value: string)`, `min`, `max`, `step` (default 1), `placeholder`, `id`, `className`, `disabled`.
- Clamps to min/max, supports empty string, keeps `inputMode="numeric"`.
- Buttons: `size-8` square, border-l/border-r on input, so it reads as one integrated control.

### 3. Swap number inputs to `NumberInput`
Replace every `<Input type="number" ... />` (and the raw `<input type="number">` in superadmin pages) in the files below:
- `src/routes/database.tsx` (salary min/max filters + form fields)
- `src/routes/positions.tsx` (openings)
- `src/routes/client.upload.tsx` (openings)
- `src/routes/billing.clients.$clientId.tsx`
- `src/routes/superadmin.settings.tsx`
- `src/routes/superadmin.agencies.new.tsx`
- `src/routes/superadmin.agencies.$id.tsx`
- `src/components/edit-candidate-dialog.tsx` (salary min/max)
- `src/components/edit-position-dialog.tsx` (openings)
- `src/components/edit-terms-dialog.tsx` (fees, days, percentages — keeps `step` for decimals)
- `src/components/confirm-joining-dialog.tsx` (CTC)

Behavior and validation stay identical; only the control chrome changes.

## Out of scope
- No changes to server functions, schemas, or business logic.
- Non-number inputs untouched.
