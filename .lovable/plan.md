## Goal

On the admin clients list (`/admin/clients`), surface three new data points per client so low-priority accounts are easy to spot:

1. **Joined on** — when the client account was created (`clients.created_at`).
2. **Closed positions** — count of positions where status = `closed`.
3. **Last billing** — date + amount of the most recent invoice for that client.

Detail page is unchanged for now.

## Changes

### `src/lib/clients.functions.ts` — extend `listClients`
- Already aggregates open positions from `positions`. Extend the same query to also count `status === "closed"` per client.
- Add a second aggregation: fetch `invoices` (`client_id, total_amount, issue_date, created_at`) ordered by date desc, group-by client to pick each client's latest invoice (date + amount + currency).
- Extend `ClientRow` with: `closed_positions?: number`, `last_invoice_at?: string | null`, `last_invoice_amount?: number | null`, `last_invoice_currency?: string | null`.

### `src/routes/admin.clients.tsx` — render new columns
In the `ClientItem` row's stats strip (next to "Open positions"):
- Add **Joined** — formatted from `created_at` (e.g. "Mar 2025" or `Xd ago` for recent).
- Add **Closed** — `c.closed_positions ?? 0`.
- Replace/augment "Last activity" with **Last billing** — `<amount> · <Xd ago>`, or muted "No invoices" when null.
- Add a subtle low-priority hint: if `closed_positions === 0` AND no invoice in the last 90 days, show a small muted "Low priority" chip on the row.

No schema migration needed — `invoices` table already exists.

## Out of scope
- Client detail page changes.
- Sorting/filtering by these new fields (can follow up).
