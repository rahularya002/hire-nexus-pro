## Goal
Let agency admins/leads onboard existing clients in bulk from an Excel file, auto-generate login credentials for each, and download a credentials Excel to share with the clients.

## UX (in `src/routes/admin.clients.tsx`)
Add a **"Bulk import"** button next to the existing "Add client" CTA. Opens a `BulkImportClientsDialog` with:
1. **Download template** button → generates `clients-template.xlsx` with columns:
   `name*, industry, contact_name, contact_email*, contact_phone, website, pan_number, gst_number, registered_address, notes, login_email (optional — defaults to contact_email), login_password (optional — auto-generated if blank), full_name (optional)`
   Includes a second `Instructions` sheet describing required fields.
2. **Upload .xlsx** → parse client-side with `xlsx` (already installed for candidate bulk import).
3. **Preview grid** showing parsed rows, per-row validation (missing name/email, duplicate email in sheet, invalid email format). Invalid rows are flagged; user can proceed with only valid rows.
4. **Import** button → calls a new server fn `bulkOnboardClients` that processes rows sequentially (to keep auth-user creation reliable), returning per-row `{ status: "ok" | "skipped" | "error", client_name, login_email, login_password, error? }`.
5. On completion → success summary + **"Download credentials Excel"** button that builds `client-credentials-<timestamp>.xlsx` from the results (columns: Client, Contact name, Login email, Password, Portal URL, Status/Error). Auto-download is not forced so the admin can inspect first.

## Server (`src/lib/clients.functions.ts`)
Add `bulkOnboardClients` server fn:
- Middleware: `requireSupabaseAuth`; verify caller is `admin` or `lead_recruiter` (same gate as `onboardClientWithLogin`).
- Input: `z.array(bulkRowSchema).max(200)` — reuses the existing `onboardSchema` fields; `login_password` optional.
- For each row:
  - If `login_password` missing → generate a 12-char random password (crypto.randomUUID-based, mixed case + digits).
  - If `login_email` missing → fall back to `contact_email`.
  - Reuse the same auth-user creation + role + profile activation + client insert flow that `onboardClientWithLogin` already implements (factor a shared internal helper `onboardOne(row, callerId, agencyId)` to avoid duplication).
  - Catch per-row errors (e.g. email already registered) and return them instead of aborting the batch.
- Resolves caller's `agency_id` once before the loop.
- Returns `{ results: BulkResult[] }`.

## Portal URL for credentials sheet
Use `window.location.origin + "/client/login"` on the client after import returns — no server config needed.

## Out of scope
- No changes to candidate bulk import.
- No email delivery of credentials (admin shares manually via the exported sheet).
- No update-existing-client mode; import is create-only. Duplicate emails surface as row errors.
- No schema changes.

## Technical notes
- `xlsx` package already in the project (used by candidate bulk import in `database.tsx`) — reuse the same read/write pattern.
- Sequential processing avoids Supabase Admin API rate limits and keeps rollback semantics of `onboardClientWithLogin` per row.
- Passwords are only ever returned in the server-fn response so the admin can export once; not persisted anywhere beyond Supabase Auth's hashed store.
