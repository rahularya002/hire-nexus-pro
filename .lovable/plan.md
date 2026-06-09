## Goal

Walk the entire tenant lifecycle end-to-end in the live preview, fixing gaps as I hit them. Add optional PAN/GST fields on clients (no full KYC workflow), then run the full QA pass.

## Phase 1 — Small gap fixes before QA

1. **Client tax fields (optional, no verification flow)**
   - Add nullable columns to `clients`: `pan_number`, `gst_number`, `registered_address`, `website`.
   - Add these fields to the agency-side Create/Edit client form (all optional).
   - Display them on the client detail page in a "Company details" block, hidden when empty.
   - No status, no document upload, no verification — just plain text fields.

2. **Login routing sanity**
   - Confirm `admin@gmail.com` → `/superadmin`, `agency@gmail.com` → `/dashboard`, client users → `/client`. Fix any stale redirect on the way.

3. **Agency-scoped data isolation — flag only**
   - Today `clients` / `positions` / `candidates` have role-based RLS but no `agency_id`. Multiple agencies would see each other's data. I'll call this out in the QA report, not refactor it this pass unless you say so.

## Phase 2 — End-to-end QA script (in preview)

**A. Super Admin (`admin@gmail.com`)**
- Land on `/superadmin`. Create a new agency (name, slug, owner email/password, plan, trial, MRR).
- Verify it shows in `/superadmin/agencies`, owner profile + role created, and rolls up into revenue / subscriptions / usage.
- Toggle suspend/reactivate, edit plan.

**B. Agency (new owner login)**
- Lands on `/dashboard`. Invite a recruiter from the team page; check role + notification.
- Create a client incl. the new PAN/GST/address/website fields. Verify it appears in `/admin/clients` and `/clients/$id` with the company details block.
- Set billing terms for the client.

**C. Client (client portal)**
- Log in as the client user → `/client`.
- Create a requirement (position) with JD + skills + openings. Confirm it surfaces in the agency's `/positions` and `/ongoing`.

**D. Fulfillment loop (agency)**
- Assign a recruiter to the position.
- Run Scout (Apify) → sourced candidates appear; shortlist one → candidate created with `linkedin_url` and the "Message on LinkedIn" button on both agency + client cards.
- Walk pipeline: shortlisted → interview scheduled → feedback → offer → placement.
- Verify notifications hit the client at each stage, visible on `/client/activity` + bell.
- Generate invoice from placement; check `/billing` totals + line items.

**E. Cross-cutting**
- Messaging thread agency ↔ client with attachment.
- Document sharing both directions.
- Notification bell counts, deep links, mark-read.
- Logout from each role → `/login`, no protected-data flash on back button.

## Phase 3 — Deliverable

QA report in chat:
- ✅ working
- ⚠️ rough (UX nits)
- ❌ broken — with root cause + proposed fix
- Security/tenant-isolation notes flagged separately for your call.

## Open questions

1. OK to create throwaway test data in your live DB during QA (prefixed `[QA]`, cleaned up at the end)?
2. For broken items I find: fix them inline during this pass, or list them all in the report and let you pick what to fix next?
