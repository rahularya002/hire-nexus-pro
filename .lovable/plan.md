## What's actually happening

**1. It's slow because everything is single-file.** From the code as it stands:

- `processRunBatch` takes only **8 messages per call** (`pageSize = 8` in `src/lib/email-import.server.ts`).
- Inside that batch, messages are handled **strictly one after another** in a `for` loop. Each message does, in series: 2 dedup lookups → 1 thread lookup → Gmail `getMessage` → attachment download → resume-text parse → resume-hash cache lookup → classification → storage upload → 2-3 inserts.
- The browser loop in `src/routes/email-archive.tsx` also calls `getImportProgress()` **before every batch**, then waits for the batch to finish before requesting the next one — one HTTP round trip per 8 emails, nothing overlapping.

At 8,535 emails that's ~1,070 sequential server calls, each containing ~8 sequential Gmail + database + storage waits. The bottleneck is round trips and serialization, not AI.

**2. Nothing is being AI-enriched during import.** "Profiles enriched" is just the `people_enriched` counter. It goes up in two harmless cases in `email-import.server.ts`:
- an email matched a person already in the archive (by email/phone), so it merged into that person instead of creating a new one;
- an email had no resume but belonged to a thread already linked to a person, so it was filed onto that person's timeline.

No extra AI call, no external lookup. The word "enriched" reads like a paid enrichment step, which is why it looks wrong. AI summaries stay on-demand as they are today.

## Plan

### Make the import fast

1. **Process each batch concurrently.** Refactor the per-message body of `processRunBatch` into one `processMessage()` function and run the page through a bounded concurrency pool (default 6 in flight) instead of a `for` loop, accumulating counters from the settled results.
2. **Raise the page size.** Move `pageSize` to `src/lib/pipeline/config.ts` (`PIPELINE_BATCH_SIZE`, default 25) so one server call covers 25 emails instead of 8.
3. **Collapse per-message round trips.** Do the "already seen?" checks for the whole page in two batched `in(...)` queries (`email_messages`, `email_import_skips`) before processing, instead of 2-3 queries per message, and reuse that set for the thread-known check.
4. **Drop the redundant progress fetch in the client loop.** Use the `done`/status returned by the batch call to decide whether to continue; keep the existing polling query for UI only. Also keep 2 batch calls in flight so network latency overlaps with server work.
5. **Keep correctness guards:** per-message failures stay isolated (one bad email must not fail the page), the run's counters remain a single update at the end of the batch, and pause/stop still take effect between batches.

### Fix the confusing metric

6. Rename the tile in `src/components/email-archive/recovery-panel.tsx` from **"Profiles enriched"** to **"Merged into existing"**, with a tooltip: "Emails that matched someone already in your archive and were added to their timeline instead of creating a duplicate." No data or logic change — labels only.

### Verify

7. Run a real import against the connected mailbox and compare emails-scanned-per-minute before/after, confirming counters, review queue, and dedup behaviour are unchanged.

## Technical notes

- Concurrency is capped because Gmail's API rate-limits per user and each attachment download plus storage upload is bandwidth-heavy; 6 in flight is safe and can be tuned via env (`PIPELINE_MESSAGE_CONCURRENCY`).
- The archive person upsert (`upsertPersonFromPayload`) mutates shared rows, so it stays serialized: workers classify and store attachments in parallel, then the write phase applies results in order to preserve dedup/merge semantics.
- Expected result: roughly an order of magnitude fewer round trips and 4-6x throughput per batch, with no change in AI spend.
