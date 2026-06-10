## Add custom payment deadline on invoice creation

Today the agency clicks **Generate invoice** on a client's billing page and the due date is auto-set from `terms.payment_terms_days`. You want the agency to pick a deadline (e.g. 30 / 45 / 60 days) at the moment of generating the invoice.

### UX

In `src/routes/billing.clients.$clientId.tsx`, replace the single **Generate invoice** button with a small dialog:

- Preset chips: **Net 15 · 30 · 45 · 60 · 90** (default = client's `payment_terms_days`)
- A "Custom" number input (0–180 days)
- Read-only line showing the resulting **Due date** (issue date + N days)
- **Generate** / Cancel

After generate → navigate to the new invoice page (existing behavior preserved).

On the invoice detail page (`billing.invoices.$invoiceId.tsx`), surface the chosen deadline more prominently as **"Due in N days"** next to the due date (small QoL).

### Backend

`generateInvoiceForClient` in `src/lib/billing.functions.ts`:

- Accept optional `paymentTermsDays: number (0–180)` in the input validator.
- If provided, override `terms.payment_terms_days` only for this invoice's `due_date` calculation: `due_date = issue_date + paymentTermsDays`.
- Persist the override into the existing `invoices.due_date` column — no schema change needed.
- Stored client-level `payment_terms_days` in `client_billing_terms` stays untouched (it remains the default for next time).

### Out of scope

- Editing the deadline after the invoice is generated.
- Changing the default `payment_terms_days` on the client (already editable via "Edit terms").
- Per-line-item deadlines.

### Files touched

- `src/lib/billing.functions.ts` — extend `generateInvoiceForClient` input + due-date calc.
- `src/routes/billing.clients.$clientId.tsx` — replace button with deadline dialog.
- `src/routes/billing.invoices.$invoiceId.tsx` — show "Due in N days" badge (small).