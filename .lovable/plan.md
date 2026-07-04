## 1. Agency · Closed positions grouped by client

File: `src/routes/closed.tsx`

- Group `positions.filter(status==='closed')` by `p.client?.id`.
- Render one collapsible section per client with:
  - Client header row: color dot + client name + counts (`X closed positions · Y placements`).
  - Grid of the existing closed-position cards underneath (same card design, unchanged).
- Sort clients by total placements desc, then by name.
- Add a lightweight client filter chip row at the top ("All · Client A · Client B") so an agency can jump straight to one client.
- Empty state unchanged.

No schema or server-function changes.

## 2. Candidate database · CV upload

Schema already has `candidates.resume_url` and `documents` supports `kind='resume'`. Wire it into the UI.

Files:
- `src/routes/database.tsx` — Add Candidate dialog + detail sheet
- `src/lib/candidates.functions.ts` — accept `resume_url` on create (already in schema)

Add Candidate dialog:
- New "CV / Resume" field: file input (PDF/DOC/DOCX, max 10 MB).
- On submit: if file present, upload to Supabase Storage `documents` bucket at `candidates/{userId}/{ts}-{name}`, call `createDocument({ kind:'resume', ... })`, then pass the resulting public URL as `resume_url` when creating the candidate.
- Show upload progress / error inline; block submit until upload completes.

Candidate detail sheet:
- New "CV" row in Profile tab: if `resume_url` present, show filename + "Open" / "Download" buttons; otherwise show "Upload CV" button that opens the same upload flow and patches the candidate via existing `updateCandidate`.

Table:
- Add a small paperclip icon in the Candidate cell when `resume_url` is present, so recruiters can see at a glance who has a CV.

`EditCandidateDialog` (`src/components/edit-candidate-dialog.tsx`): add the same CV upload/replace control so existing candidates can get a CV attached.

## 3. Client dashboard hero · spotlight Upload JD

File: `src/routes/client.index.tsx` (hero block only, lines ~74-103)

Replace the current single-column hero with a 2-column layout on `lg+`:

```text
┌──────────────────────────────┬──────────────────────────┐
│ Left (col-span-2 on lg)      │ Right                    │
│ - Eyebrow                    │ Primary CTA card:        │
│ - "Welcome back, {company}"  │  ┌────────────────────┐  │
│ - Snapshot sentence          │  │  ↑  Upload New JD  │  │
│ - Small "N mandates · M      │  │  Start a search    │  │
│   profiles shared" chips     │  │  in 60 seconds     │  │
│                              │  │  [ Upload JD ]     │  │
│                              │  └────────────────────┘  │
│                              │ Secondary CTA (link):    │
│                              │  + Create position       │
│                              │    manually              │
└──────────────────────────────┴──────────────────────────┘
```

Details:
- Right column: prominent card with gradient background, dashed drop-zone-style border, large upload icon, headline "Upload a JD", one-line helper, and a solid button. Whole card is a `Link to="/client/upload"`.
- Below the card, a smaller `Link to="/client/upload"` styled as a ghost row "+ Create position manually" (routes to same page; the upload page already lets users skip file upload and fill the form).
- On mobile the two columns stack; CTA card stays full-width and visually dominant.
- Existing team dashboard (`ClientTeamDashboard`) is untouched — this change is for the primary client dashboard only.

## Out of scope

- No changes to JD upload logic itself, positions server functions, or notifications.
- No new tables or migrations (existing `resume_url` + `documents` cover the CV work).
