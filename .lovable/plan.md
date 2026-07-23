## Redesign `/closed` — Editorial Archive

Rebuild `src/routes/closed.tsx` to match the selected "Editorial archive v2" direction while keeping the existing app theme tokens (no hardcoded `#0d0c0b`, no external Google Fonts — use the app's existing font stack).

### Data
Fetch in parallel via existing server fns (already in file):
- `listPositions` → filter `status === "closed"`
- `listApplications` → count placements per position (fallback when no placement row exists)
- **New:** call `listPlacements` (already exported from `interviews.functions.ts`) to pull candidate name, `joining_date`, and `ctc_display` per position.

Group by client. Per position, hydrate with placement rows (0..n candidates).

### Layout

```text
┌─ Header row ─────────────────────────────────────────┐
│ [• HISTORICAL ARCHIVE]         Total closed    N     │
│ Closed positions               Total placements N    │
│ subtitle                       Top client       X    │
├─ Client filter chips (subtle, orange active) ────────┤
├─ For each client group ──────────────────────────────┤
│ [color-tile] Client name  ────gradient rule────      │
│                                                      │
│ Featured card (first / top position) — full card:    │
│  Title + "Completed" pill  |  Seats filled  Closed   │
│  Location · closed date                              │
│  ─────                                               │
│  Retained talent → grid of candidate chips           │
│  (avatar w/ initials, name, "Joined <month yyyy>",   │
│   ctc_display right-aligned)                         │
│                                                      │
│ Remaining positions → compact collapsed rows         │
│  Title · N placement(s) · Closed <date> · location   │
│  chevron on the right                                │
└──────────────────────────────────────────────────────┘
```

Empty state: keep the dashed panel but with a trophy illustration and copy "No wins yet — closed positions will appear here."

### Styling rules
- Use existing tokens: `bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, `text-primary` (orange), `bg-primary/10`, `border-primary/20`, `bg-success/10 text-success` for the Completed pill.
- Client color tile: `w-8 h-8 rounded-lg` filled with `g.color` fallback muted, initials in white.
- Featured card: `rounded-2xl border border-border bg-card` with header row divided by `border-b border-border`.
- Compact rows: `rounded-xl border border-border bg-card p-5` with hover `bg-muted/30` + chevron `text-muted-foreground group-hover:text-primary`.
- Candidate chip: `rounded-xl bg-muted/20 border border-border p-4`, avatar `w-11 h-11 rounded-lg` — first candidate gets `bg-primary text-primary-foreground`, rest get `bg-muted text-foreground`.
- No hardcoded hexes; no external font imports.

### Stats
- Total closed = sum across groups.
- Total placements = sum of `placementsFor(p.id)`.
- Top client = group with most placements (falls back to most closed positions).

### Interactivity
- Client filter chips (existing behavior preserved) — active chip gets `bg-primary/15 text-primary border-primary/30`.
- Featured vs compact split: first position per client shown featured; if a client has only one position, it stays featured. Compact rows navigate to `/positions/$positionId` on click.
- Candidate chips link to `/candidates/$candidateId` when candidate id is available.

### Files touched
- `src/routes/closed.tsx` — full rewrite of the page body (route boilerplate preserved).

No schema changes. No backend changes. No changes outside this route file.
