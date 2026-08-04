## What's duplicated

The page shows the same information twice:

- The **panel** (top card) shows the *last run's* counters: emails scanned, candidates imported, merged, need your call, no candidate found.
- The **tile row** below shows *archive totals*: imported candidates, imported to database, needs your call, recruiting history, last sync.

They overlap on three numbers (imported candidates, needs your call, recruiting history/no candidate found) and never match exactly — the panel counts one run, the tiles count everything in the archive. That's why "4,733" and "4772" sit next to each other.

## Plan

Collapse to **one stats row** — the archive totals — and turn the panel into a pure status/action card.

1. In `recovery-panel.tsx`, remove the 5-metric grid from the finished and running states. Replace with a single compact line under the headline:
   - finished: "33,104 emails scanned · up to 3 Aug 2026"
   - running: keep the progress bar, emails/min and ETA (the only genuinely run-scoped info).
   Keep the buttons (Browse imported candidates / Review N items / Import more history) exactly as they are.

2. In `email-archive.tsx`, keep the tile row as the single stats surface, driven by the exact archive counts already fetched by `getArchiveCounts`. Add a **Merged into existing** tile so nothing from the panel is lost, and make each tile jump to its tab where one exists.

3. Tile set after the change: Imported candidates · Imported to database · Merged into existing · Needs your call · Recruiting history · Last sync (6 tiles, 3-across on desktop, 2-across on mobile).

4. Per-run numbers stay available in **Import history**, which already lists each run's counters — so nothing is lost, it just isn't shown twice on the dashboard.

### Technical details
Files: `src/components/email-archive/recovery-panel.tsx`, `src/routes/email-archive.tsx`. If `getArchiveCounts` doesn't yet return a merged-into-existing total, add it there (`src/lib/email-import.functions.ts`) as an exact count. No schema change, no migration, no effect on running imports.
