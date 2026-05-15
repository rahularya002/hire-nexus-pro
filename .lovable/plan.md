## Billing module — per-client custom terms, joining-based invoicing

A new "Billing" section in the agency workspace that models real-world recruitment invoicing: each client has its own commercial terms, billing cycle and invoice day, and invoices are generated only for candidates who **actually joined** during that cycle — with full visibility into placements, replacements, and exits.

### 1. Sidebar entry

Add a **Billing** item to `agencyNav` in `src/components/app-shell.tsx` (between "Closed" and "Recruiter Roster"), icon `Receipt`. Agency workspace only — not exposed in the recruiter portal or client portal.

### 2. Data model (mock, in `src/lib/billing-data.ts`)

- **ClientBillingTerms** — per client:
  - `feeModel`: `"percent_ctc" | "flat_per_hire" | "tiered"`
  - `feeValue`: e.g. 8.33% of CTC, ₹1.5L flat, or tier table by CTC band
  - `replacementWindowDays` (e.g. 90)
  - `replacementPolicy`: `"free_replacement" | "pro_rata_credit" | "none"`
  - `billingCycle`: `"monthly" | "per_joining"`
  - `invoiceDayOfMonth` (e.g. 5th, 15th, 25th — different per client)
  - `paymentTermsDays` (Net 15 / 30 / 45)
  - `gstPct`, `tdsPct`, `currency`, `poRequired`, `poNumber`
- **JoiningEvent** — one row per candidate movement (the source of truth for billing):
  - `clientId`, `positionId`, `candidateName`, `ctc`
  - `offerDate`, `joiningDate`, `status`: `"joined" | "replacement_for" | "left_in_window" | "no_show"`
  - `replacesEventId?` (links a replacement back to the original)
  - `billable: boolean` (computed from terms + status)
  - `feeAmount` (computed)
- **Invoice** — generated per client per cycle:
  - `clientId`, `invoiceNo`, `period` (from/to), `issueDate`, `dueDate`
  - `lineItems[]` derived from `JoiningEvent`s in the cycle (placement, replacement = ₹0 if covered, credit note for in-window exits if pro-rata)
  - subtotal, GST, TDS, total
  - `status`: `"draft" | "sent" | "paid" | "overdue" | "cancelled"`

Seed 6 clients (reuse existing client list) with **different terms** (e.g. Razorpay = 8.33% CTC monthly billing on the 1st, Net 30; Rolex India = flat ₹2L per hire, billed on joining; Tata Digital = tiered, billed on the 15th, Net 45) and seed joining events that include placements + one replacement + one in-window exit so all line-item types render.

### 3. Routes

- **`/billing`** — overview
  - KPI strip: MTD billable, outstanding (sent + overdue), this-month forecast (joinings expected this cycle), replacements active
  - "Upcoming invoice runs" — list of clients whose invoice day falls in the next 14 days, with preview of accrued line items
  - Recent invoices table (client, period, total, status, due date) with filters
  - Tab/section: "Joinings ledger" — all `JoiningEvent`s with status chips (Joined / Replacement / Left in window / No-show)

- **`/billing/clients/$clientId`** — per-client billing profile
  - Terms card (editable mock form: fee model, replacement window/policy, cycle, invoice day, payment terms, GST/TDS, PO)
  - Current cycle accrual: live list of joinings in the open period with computed fee
  - Invoice history table
  - Replacement tracker: who's still inside the guarantee window, days remaining

- **`/billing/invoices/$invoiceId`** — invoice detail
  - Header: invoice no, client, period, issue/due dates, PO, status
  - Detailed line items — for each candidate row show: name, position, joining date, CTC, fee basis, fee amount, **status badge** (Placed / Replacement (covered) / Left in window / Credit note)
  - Totals: subtotal, GST, TDS, net payable
  - Actions: Mark sent, Mark paid, Download PDF (mock), Send reminder

### 4. Generation logic (pure functions in `billing-data.ts`)

- `getOpenCycle(client, today)` → `{from, to}` based on `invoiceDayOfMonth`.
- `accruedLineItems(clientId, cycle)` → walks `JoiningEvent`s with `joiningDate` inside the cycle, applies terms:
  - `joined` → billable line, fee per `feeModel`
  - `replacement_for` → ₹0 line tagged "Replacement (covered)" if within window and policy = free
  - `left_in_window` → negative-amount credit note line if policy = pro_rata
  - `no_show` → not billed
- `generateInvoice(clientId, cycle)` → builds `Invoice` from accrual + GST/TDS.

### 5. Cross-links

- Client detail page (`/clients/$clientId`) gets a "Billing" tab linking to `/billing/clients/$clientId`.
- Closed positions page gets a "View invoice" link when a joining produced one.
- Existing `placements` data on the client portal stays untouched; the agency-side billing is the new source of truth.

### Technical notes

- All UI uses existing semantic tokens and shadcn primitives (Card, Table, Badge, Tabs, Dialog for the terms-edit form).
- No backend yet — everything is in-memory mock with a tiny subscribe/notify store like `setRecruiterStatus` so "Mark paid" updates KPIs live.
- File additions: `src/lib/billing-data.ts`, `src/routes/billing.tsx`, `src/routes/billing.clients.$clientId.tsx`, `src/routes/billing.invoices.$invoiceId.tsx`. Edits: `src/components/app-shell.tsx` (nav), `src/routes/clients.$clientId.tsx` (Billing tab link).
