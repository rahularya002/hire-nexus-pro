// Query-driven retrieval: list a small Gmail page for the current query variant,
// hydrate only a slice of it, rank against the plan, and store the hits.
// Reuses the existing deterministic + AI classification pipeline unchanged.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAttachmentBytes, getMessage } from "../gmail.server";
import { gmailMessageToRawItem } from "../gmail-discovery.server";
import { classifyItem } from "../pipeline/classify.server";
import { cleanBodyText, extractDeterministic, sha256Bytes } from "../pipeline/normalize.server";
import { emptyMetrics } from "../pipeline/types";
import { candidateEvidence, heuristicScore, isCandidateArtifact } from "../recruitment-classify.server";
import type { CandidatePayload, StoredAttachment } from "../email-import.server";
import {
  SEARCH_HYDRATE_PER_BATCH,
  SEARCH_LIST_PAGE,
  SEARCH_MAX_HYDRATED,
  SEARCH_MAX_LISTED,
  SEARCH_TARGET_HITS,
} from "../pipeline/config";
import { listSearchPage } from "./gmail-search.server";
import type { SearchPlan } from "./query-plan.server";
import { rankItem } from "./rank.server";

export type SearchRow = {
  id: string;
  agency_id: string;
  user_id: string;
  raw_query: string;
  plan: SearchPlan;
  gmail_queries: string[];
  query_index: number;
  page_token: string | null;
  listed_count: number;
  hydrated_count: number;
  hit_count: number;
  ai_calls: number;
  cache_hits: number;
  status: string;
};

async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

type HitRow = Record<string, unknown>;

/**
 * One streaming slice of a search. Returns whether the search is finished so the
 * caller can loop until done (or until it has enough results).
 */
export async function runSearchSlice(
  search: SearchRow,
  accessToken: string,
  googleEmail: string | null,
): Promise<{ done: boolean; listed: number; hydrated: number; newHits: number }> {
  const plan = search.plan;
  const metrics = emptyMetrics();

  if (search.listed_count >= SEARCH_MAX_LISTED || search.hydrated_count >= SEARCH_MAX_HYDRATED) {
    return { done: true, listed: 0, hydrated: 0, newHits: 0 };
  }

  const page = await listSearchPage(
    accessToken,
    search.gmail_queries,
    search.query_index,
    search.page_token,
    SEARCH_LIST_PAGE,
  );

  // Never look at the same message twice within one search.
  const ids = page.refs.map((r) => r.id);
  const seen = new Set<string>();
  if (ids.length) {
    const { data } = await supabaseAdmin
      .from("email_search_hits")
      .select("gmail_message_id")
      .eq("search_id", search.id)
      .in("gmail_message_id", ids);
    for (const r of (data ?? []) as { gmail_message_id: string }[]) seen.add(r.gmail_message_id);
  }

  const budget = Math.max(0, Math.min(SEARCH_HYDRATE_PER_BATCH, SEARCH_MAX_HYDRATED - search.hydrated_count));
  const todo = page.refs.filter((r) => !seen.has(r.id)).slice(0, budget);
  const mine = (googleEmail ?? "").toLowerCase() || null;

  const hydrate = async (ref: { id: string; threadId: string | null }): Promise<HitRow | null> => {
    try {
      const msg = await getMessage(accessToken, ref.id);
      const raw = gmailMessageToRawItem(msg, ref.threadId);
      const bodyText = cleanBodyText(raw.bodyText);
      const attNames = raw.attachments.map((a) => a.fileName);
      const baseSignal = {
        fromEmail: raw.fromEmail,
        fromName: raw.fromName,
        toEmails: raw.toEmails,
        myEmail: mine,
        subject: raw.subject,
        bodyText,
        attachmentNames: attNames,
        docText: "",
        threadKnown: false,
      };

      // Same cheap gate the importer uses — obvious noise never gets downloaded.
      const pre = heuristicScore(baseSignal);
      const preEv = candidateEvidence(baseSignal);
      if (pre.score <= 12 && preEv.score <= 12 && !preEv.uncertainty) return null;

      let docText = "";
      let primaryBytes: Uint8Array | null = null;
      let primaryHash: string | null = null;
      const primary = raw.attachments[0] ?? null;
      if (primary) {
        try {
          primaryBytes = await getAttachmentBytes(accessToken, ref.id, primary.externalId);
          primaryHash = await sha256Bytes(primaryBytes);
          const { data: known } = await supabaseAdmin
            .from("email_resume_versions")
            .select("extracted_text")
            .eq("user_id", search.user_id)
            .eq("content_sha256", primaryHash)
            .not("extracted_text", "is", null)
            .limit(1)
            .maybeSingle();
          if (known?.extracted_text) {
            docText = known.extracted_text as string;
            metrics.cacheHits++;
          } else {
            const { extractCvText } = await import("../cv-parse.server");
            docText = await extractCvText(primaryBytes, primary.fileName, primary.mimeType);
          }
        } catch {
          docText = "";
        }
      }

      const det = extractDeterministic({
        fromEmail: raw.fromEmail,
        fromName: raw.fromName,
        cleanBody: bodyText,
        docText,
        primaryFileName: primary?.fileName ?? null,
      });

      const cls = await classifyItem({
        userId: search.user_id,
        signal: { ...baseSignal, docText },
        deterministic: det.fields,
        gaps: det.gaps,
        attachmentHashes: primaryHash ? [primaryHash] : [],
        metrics,
      });

      // Search only surfaces people, never JDs or mandate lists.
      if (cls.decision === "skip" || !isCandidateArtifact(cls.artifact)) return null;

      const haystack = [
        raw.subject,
        bodyText.slice(0, 4000),
        docText.slice(0, 8000),
        cls.extracted.role,
        cls.extracted.location,
        (cls.extracted.skills ?? []).join(" "),
      ]
        .filter(Boolean)
        .join(" \n ");

      const ranked = rankItem(plan, {
        extracted: cls.extracted,
        confidence: cls.confidence,
        hasResume: !!primary,
        sentAt: raw.sentAt,
        haystack,
      });

      // Store the resume so the recruiter can open it straight from the result.
      const stored: StoredAttachment[] = [];
      if (primary && primaryBytes) {
        const safe = primary.fileName.replace(/[^\w.\-]+/g, "_");
        const path = `email-archive/${search.user_id}/${ref.id}-${safe}`;
        try {
          const up = await supabaseAdmin.storage
            .from("documents")
            .upload(path, primaryBytes, { upsert: true, contentType: primary.mimeType ?? undefined });
          if (up.error) throw new Error(up.error.message);
          stored.push({
            path,
            file_name: primary.fileName,
            mime: primary.mimeType,
            size: primary.size,
            content_sha256: primaryHash,
            extracted_text: docText,
          });
        } catch {
          /* result still usable without the stored file */
        }
      }

      const payload: CandidatePayload = {
        agency_id: search.agency_id,
        user_id: search.user_id,
        gmail_message_id: ref.id,
        gmail_thread_id: ref.threadId,
        subject: raw.subject,
        snippet: msg.snippet ?? null,
        from_email: raw.fromEmail,
        from_name: raw.fromName,
        to_emails: raw.toEmails,
        direction: raw.fromEmail && mine && raw.fromEmail === mine ? "outbound" : "inbound",
        sent_at: raw.sentAt,
        confidence: cls.confidence,
        email_kind: cls.kind,
        artifact_type: cls.artifact,
        reason: cls.reason,
        signals: cls.signals,
        extracted: cls.extracted,
        attachments: stored,
        body_text: bodyText,
      };

      return {
        search_id: search.id,
        agency_id: search.agency_id,
        user_id: search.user_id,
        gmail_message_id: ref.id,
        gmail_thread_id: ref.threadId,
        subject: raw.subject,
        snippet: msg.snippet ?? null,
        from_email: raw.fromEmail,
        from_name: raw.fromName,
        sent_at: raw.sentAt,
        score: ranked.score,
        score_parts: ranked.parts,
        confidence: cls.confidence,
        artifact_type: cls.artifact,
        reason: cls.reason,
        extracted: cls.extracted,
        pending_payload: payload,
        resume_storage_path: stored[0]?.path ?? null,
        resume_file_name: stored[0]?.file_name ?? null,
        origin: "gmail",
      } satisfies HitRow;
    } catch {
      return null;
    }
  };

  const rows = (await pool(todo, 8, hydrate)).filter((r): r is HitRow => !!r);
  if (rows.length) {
    await supabaseAdmin.from("email_search_hits").upsert(rows as never, { onConflict: "search_id,gmail_message_id" });
  }

  const listed = search.listed_count + page.refs.length;
  const hydrated = search.hydrated_count + todo.length;
  const hitCount = search.hit_count + rows.length;
  const done =
    page.exhausted ||
    listed >= SEARCH_MAX_LISTED ||
    hydrated >= SEARCH_MAX_HYDRATED ||
    hitCount >= SEARCH_TARGET_HITS;

  await supabaseAdmin
    .from("email_searches")
    .update({
      query_index: page.nextQueryIndex,
      page_token: page.nextPageToken,
      listed_count: listed,
      hydrated_count: hydrated,
      hit_count: hitCount,
      ai_calls: (search.ai_calls ?? 0) + metrics.aiCalls,
      cache_hits: (search.cache_hits ?? 0) + metrics.cacheHits,
      status: done ? "done" : "running",
      finished_at: done ? new Date().toISOString() : null,
    })
    .eq("id", search.id);

  return { done, listed: page.refs.length, hydrated: todo.length, newHits: rows.length };
}