# Agencies per client + remove "sourced" from client-facing views

Two independent changes against the mock data and the relevant routes.

## 1. Agencies a company works with

### Data (`src/lib/mock-data.ts`)

Extend the `Client` shape with an array of agency engagements:

```ts
export interface ClientAgencyEngagement {
  id: string;              // "ta-talentflow"
  name: string;            // "TalentFlow"
  initials: string;
  color: string;
  spoc: string;            // agency-side relationship lead
  positions: {
    id: string;
    title: string;
    status: PositionStatus;
    openings: number;
    location: string;
    postedDays: number;
    candidatesShared: number;
    closures: number;
  }[];
}
```

Add `agencies: ClientAgencyEngagement[]` to `Client` and seed each existing client with 1–3 agencies (TalentFlow + a couple of competitors like Antal, Michael Page, Randstad). Most positions can mirror what's in the existing `positions` array for that client; add 1–2 extra for the other agencies so the page feels real.

### List card (`src/routes/admin.clients.tsx`)

Add a small "N agencies" stat between "Closures YTD" and "Revenue YTD". No row-level interaction change — single click already opens the detail page.

### Detail page (`src/routes/clients.$clientId.tsx`)

Add an **Agencies** section above the existing "Open positions" block:

- One card per agency: avatar + name + agency SPOC + counters (open positions, candidates shared this quarter, closures YTD).
- Click an agency card → expands inline to reveal its positions table (title, status, openings, candidates shared, closures, posted X days ago). Click a position → opens existing `/positions/$positionId` page when it matches an entry in `positions[]`; otherwise a small "Agency-side requirement — details with TalentFlow's portal" subline.

No new route needed — expand-in-place keeps it light and avoids a new file. (The user's "double click → page" was directional; an expandable list on the same page is the same mental model and avoids dead-end navigation.)

## 2. Client dashboard: hide "sourced", show real funnel

The client should never see internal sourcing counts. Replace with the agency-visible funnel: Shared / Shortlisted / Interviewed / Offered / Rejected.

### `src/routes/client.index.tsx`

Replace the 4 KPIs with 5 funnel tiles:

- Profiles shared (sum of `funnel.shared`)
- Shortlisted (`funnel.shortlisted`)
- Interviewed (`funnel.interview`)
- Offered (`funnel.offered`)
- Rejected (count of candidates with `status === "rejected"` across all positions)

Keep "Open positions" badge in the hero, drop the "Placed YTD" tile (it's now duplicative with Offered).

Per-position row inline stats: replace `{ Shared, Shortlisted, Pending review }` with `{ Shared, Shortlisted, Interviewed, Offered, Rejected }` rendered as a tighter strip.

### `src/routes/client.positions.tsx`

In the per-position stage counter, drop the `sourcing` step from the visible breakdown (keep it in the data but don't render it). Steps shown to the client: Shared → Shortlisted → Interviewed → Offered → Joined.

### `src/routes/client.reports.tsx`

Remove the **Sourced** bar and the **Sourced (all time)** stat. Recompute "conversion" as `joined / shared` (with safe divide). Funnel chart starts at "Profiles shared".

## Files

- `src/lib/mock-data.ts` — `ClientAgencyEngagement` type + `agencies` on every client.
- `src/routes/admin.clients.tsx` — add "N agencies" stat to the row.
- `src/routes/clients.$clientId.tsx` — new Agencies section with expand-on-click positions list.
- `src/routes/client.index.tsx` — new 5-tile funnel KPIs + updated per-row stats.
- `src/routes/client.positions.tsx` — hide the "sourcing" step.
- `src/routes/client.reports.tsx` — drop sourced bar + stat, fix conversion formula.

No DB migration. All changes are mock-data + presentation.
