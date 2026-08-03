## What the data actually shows

The current run (started 05:43) has scanned **120 emails in ~290 seconds**, and 120 is a multiple of the new page size — so the batch size change *is* live: it is pulling 25 per page, not 8. What you're seeing as "8 at a time" is the *effective rate*: roughly 25 emails per minute, so each page takes ~60s and the counters creep up in small visible jumps.

The old run (started yesterday) managed 1,179 emails in 15 hours — so it is already ~20x faster. It's just still too slow for a full mailbox (8.5k emails ≈ 5–6 hours at this rate).

Where the remaining minute-per-page goes:
- Gmail `messages.get` + attachment download + parse happens 6 at a time; heavy resume attachments dominate.
- The write phase is fully serial: every candidate is upserted one at a time (visible in the database as one row every 2–4 seconds).
- Pages are strictly sequential: the browser waits for a whole page to finish before requesting the next, so Gmail latency and database latency never overlap.

## Plan

1. **Raise the parallelism defaults** in `src/lib/pipeline/config.ts`: page size 25 → 50, prepare concurrency 6 → 16. Gmail's per-user quota comfortably allows this; both stay env-overridable.

2. **Speed up the write phase** in `src/lib/email-import.server.ts`:
   - Batch the person upserts: group the page's imports by dedup key (email/phone), then process distinct people concurrently (bounded, ~6) while keeping same-key people serialized. Dedup/merge behaviour stays identical because collisions within a page are still handled in order.
   - Keep skip/attach rows as the existing single bulk insert.

3. **Pipeline the pages** so Gmail fetching overlaps database writing: after a page is fetched, immediately kick off the next page's Gmail listing/prepare while the current page writes. Implemented server-side inside one batch call (fetch page N+1's ids while writing page N), so the browser loop stays unchanged and page tokens stay strictly ordered.

4. **Trim per-email cost**: skip attachment download entirely for messages the cheap heuristic gate already rejects (currently some noise emails still pay for the download), and cap resume text extraction earlier.

5. **Show real throughput in the UI** (`recovery-panel.tsx`): add an "emails/min" figure and a live ETA next to the progress bar, so speed is observable instead of inferred.

### Restart note
These are server-side changes, but the *currently running* run will pick up new page sizes only on its next batch call; a stop/start gives a clean measurement. History is preserved either way.

### Technical details
Files touched: `src/lib/pipeline/config.ts`, `src/lib/email-import.server.ts`, `src/components/email-archive/recovery-panel.tsx`. No schema change, no migration.
