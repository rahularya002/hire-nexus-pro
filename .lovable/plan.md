## Verification plan: today's features

Drive the running preview with Playwright (headless Chromium), restore the managed Supabase session, and walk through each feature added today. Capture a screenshot at every meaningful step and drop them into `/mnt/documents/` so they render inline in the reply.

### Features to verify

1. **Drag-and-drop CV import (single + multiple)** on `/database`
   - Trigger the "Upload CVs" button → file picker path
   - Simulate drag-and-drop of a sample PDF + DOCX
   - Confirm progress modal shows Uploading → Extracting → Review
2. **Pre-save review step** for CV import
   - Open the Review dialog for an extracted candidate
   - Verify editable fields: name, email, phone, location, salary range (LPA), skills chips
   - Verify "More fields" collapsible (role, company, experience, LinkedIn, notes)
   - Verify duplicate warning + "low-confidence extraction" badges render
3. **Save individual + Save all** flow
   - Save one from the review modal → toast + row status → Saved
   - Save all remaining → check `candidates` list refreshes
4. **Skip / discard** flow
   - Skip a row → status Skipped, uploaded file discarded
5. **Bulk CV attach (Step 2 of Excel import)**
   - Open Bulk Import dialog on `/database`
   - Screenshot the Step 2 attach panel with auto-match + `ManualAttachSelect`
6. **Recent fixes**
   - Salary filter accepts values below 2 and above 100 LPA (e.g. 0.5 and 120)
   - (Sanity-only) Reschedule dialog still opens on an existing interview — no live Google Meet needed
   - (Sanity-only) Bulk client import dialog opens and shows password-optional hint

### Steps

1. Prepare fixtures under `/tmp/browser/cv-test/`: a tiny sample PDF and DOCX with fake CV text (name/email/phone/skills) so extraction has something to work with.
2. Write one Playwright script per feature block under `/tmp/browser/<slug>/run.py`, each launching a fresh browser, restoring the Supabase session from env, navigating to `http://localhost:8080/...`, performing the interaction, and saving PNGs to `./screenshots/`.
3. Run scripts sequentially; after each, `code--view` the PNGs to confirm the UI actually shows the expected state (not just that the script didn't crash).
4. Copy the confirmed screenshots into `/mnt/documents/today-tests/` with descriptive names.
5. Reply with a short pass/fail summary and inline `<presentation-artifact>` tags for each screenshot.

### Notes / risks

- If `LOVABLE_BROWSER_AUTH_STATUS` is `signed_out` or `external_unmanaged`, I can't reach `/database` — I'll stop and tell you to sign in via the preview, then re-run.
- Real AI extraction hits the Lovable AI gateway and may take a few seconds per file; scripts will wait for the "Review" status before screenshotting.
- No code changes will be made — this is verification only.
