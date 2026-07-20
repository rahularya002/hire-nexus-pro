## End-to-end verification of recently shipped features

Run a Playwright script against `http://localhost:8080` (using the injected Supabase session) that walks through every feature added across the recent turns, capturing a labelled screenshot at each stop. Save all shots under `/mnt/documents/qa/` and include them in the final reply as a gallery.

### Coverage checklist (one screenshot per item, minimum)

1. **Closed positions grouped by client** — `/closed`
2. **Candidate database**
   - CV icon column visible in table
   - Salary min/max and Location columns visible
   - Filters panel: Source client (All / Unassigned / specific), Salary, Location
   - Source-client chip rendered on a tagged candidate row
   - Add candidate dialog with Source client picker + CV upload + salary/location
   - Bulk import dialog (Excel) with Source client field + template download
   - Candidate profile sheet showing "Source client" row
3. **Client dashboard revamp** — 2-column layout, "Create a new position" card with Rocket icon
4. **Interview workflow**
   - Client `/interviews` view (mini-calendar, Next interview, tabs)
   - Agency `/interviews` mirroring the same layout with read-only status pills
   - Schedule Interview dialog showing optional manual meeting link + Google-optional warning
   - Confirm Joining dialog (CTC + dates) from a past interview
5. **Placements** — "Awaiting confirmation" section
6. **Messages** — Recruiter badge on a client_recruiter thread (admin view)
7. **AI Screener**
   - Position detail: Edit (top-right) + AI Screen button (bottom-left) with tooltip "Automated AI call"
   - AI Screener card with script editor + Rehearse/Call candidate modes
8. **Bulk client import** — dialog + generated credentials export
9. **Superadmin** — agency detail page with editable details and owner login/credentials
10. **Job posting form** — Experience + Salary range + Currency fields
11. **NumberInput** — themed +/− control in a salary field, showing INR step (1L)
12. **Pending-approval flow removed** — sign in as an unapproved-style account (or just confirm no `/pending` route redirect) and land straight in the app

### Technical notes

- Restore `LOVABLE_BROWSER_SUPABASE_*` session before navigating to any authed route.
- Viewport `1280x1800`, `headless=True`, no `full_page` screenshots.
- Use `get_by_role` / `aria-label` selectors; element screenshots for tooltips and chips.
- If any screen shows missing data (e.g. no closed positions, no interviews, no messages), note it in the reply — do not seed data in this pass.
- Deliverable: reply with a short per-feature status line plus the screenshot gallery via `<presentation-artifact>` tags for each PNG under `/mnt/documents/qa/`.
