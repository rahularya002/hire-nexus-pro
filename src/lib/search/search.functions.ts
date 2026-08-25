import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dedupeHits } from "./dedupe";

export type SearchHit = {
  id: string;
  origin: string;
  score: number;
  score_parts: { matched?: string[]; missing?: string[] } | null;
  confidence: number;
  artifact_type: string | null;
  reason: string | null;
  subject: string | null;
  snippet: string | null;
  from_email: string | null;
  from_name: string | null;
  sent_at: string | null;
  gmail_message_id: string;
  gmail_thread_id: string | null;
  resume_file_name: string | null;
  resume_storage_path: string | null;
  extracted: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    role?: string | null;
    location?: string | null;
    experience?: string | null;
    current_company?: string | null;
    skills?: string[] | null;
    salary_min?: number | null;
    salary_max?: number | null;
  } | null;
  saved_candidate_id: string | null;
  saved_at: string | null;
  dismissed_at: string | null;
  email_candidate_id: string | null;
};

export type SearchStatus = {
  id: string;
  raw_query: string;
  status: string;
  listed_count: number;
  hydrated_count: number;
  hit_count: number;
  ai_calls: number;
  cache_hits: number;
  created_at: string;
  finished_at: string | null;
};

const HIT_COLUMNS =
  "id,origin,score,score_parts,confidence,artifact_type,reason,subject,snippet,from_email,from_name,sent_at," +
  "gmail_message_id,gmail_thread_id,resume_file_name,resume_storage_path,extracted,saved_candidate_id,saved_at,dismissed_at,email_candidate_id";

async function callerAgency(supabase: any, userId: string) {
  const { data } = await supabase.from("agency_members").select("agency_id").eq("user_id", userId).maybeSingle();
  return (data?.agency_id as string | undefined) ?? null;
}

/** Start a natural-language candidate search: plan it, seed archive matches, return the id. */
export const startCandidateSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        query: z.string().min(3).max(500),
        labels: z.array(z.string().max(200)).max(20).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const agencyId = await callerAgency(context.supabase, context.userId);
    if (!agencyId) throw new Error("You must belong to an agency to search your mailbox.");

    const { planSearch } = await import("./query-plan.server");
    const { buildSearchQueries } = await import("./gmail-search.server");
    const { rankItem } = await import("./rank.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { SEARCH_ARCHIVE_LIMIT } = await import("../pipeline/config");

    // Repeated / rapid-fire identical queries reuse the last run instead of
    // paying for another plan call and another Gmail sweep.
    const raw = data.query.trim();
    const { data: recent } = await supabaseAdmin
      .from("email_searches")
      .select("id,plan,gmail_queries,hit_count,status")
      .eq("user_id", context.userId)
      .eq("raw_query", raw)
      .gte("created_at", new Date(Date.now() - 10 * 60_000).toISOString())
      .eq("status", "done")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent?.id) {
      return {
        searchId: recent.id as string,
        plan: recent.plan as never,
        queries: (recent.gmail_queries as string[] | null) ?? [],
        archiveHits: (recent.hit_count as number | null) ?? 0,
        reused: true,
      };
    }

    // A search left "running" by a closed tab or a crashed loop must not linger:
    // retire anything of this user's older than 5 minutes before starting a new one.
    await supabaseAdmin
      .from("email_searches")
      .update({ status: "done", finished_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .eq("status", "running")
      .lt("created_at", new Date(Date.now() - 5 * 60_000).toISOString());

    const { plan, aiCalls } = await planSearch(data.query);
    plan.labels = data.labels;
    const queries = buildSearchQueries(plan);

    const { data: row, error } = await supabaseAdmin
      .from("email_searches")
      .insert({
        agency_id: agencyId,
        user_id: context.userId,
        raw_query: data.query,
        plan: plan as never,
        gmail_queries: queries,
        ai_calls: aiCalls,
        status: "running",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const searchId = row?.id as string | undefined;
    if (!searchId) throw new Error("Candidate search could not be started.");

    // Archive-first: people we already know about need no Gmail call at all.
    const terms = Array.from(new Set([...plan.roles, ...plan.skills, ...plan.keywords])).slice(0, 6);
    let archived: any[] = [];
    let archiveHits = 0;
    if (terms.length) {
      const or = terms.map((t) => `search_blob.ilike.%${t.replace(/[%,()]/g, " ")}%`).join(",");
      const { data: people } = await supabaseAdmin
        .from("email_candidates")
        .select(
          "id,name,email,phone,role,location,experience,current_company,skills,salary_min,salary_max,search_blob,last_email_at,promoted_candidate_id",
        )
        .eq("user_id", context.userId)
        .or(or)
        .limit(SEARCH_ARCHIVE_LIMIT);
      archived = people ?? [];
    }

    if (archived.length) {
      const { cleanBodyText, extractDeterministic } = await import("../pipeline/normalize.server");
      const { sanitizeCandidateIdentity } = await import("../candidate-identity");
      const archiveIds = archived.map((p) => p.id as string).filter(Boolean);
      const [messageResult, resumeResult] = archiveIds.length
        ? await Promise.all([
            supabaseAdmin
              .from("email_messages")
              .select("email_candidate_id,subject,snippet,from_email,from_name,to_emails,sent_at")
              .in("email_candidate_id", archiveIds)
              .order("sent_at", { ascending: false }),
            supabaseAdmin
              .from("email_resume_versions")
              .select("email_candidate_id,file_name,extracted_text,received_at")
              .in("email_candidate_id", archiveIds)
              .order("received_at", { ascending: false }),
          ])
        : [{ data: [] }, { data: [] }];

      const messagesByPerson = new Map<string, {
        subject: string | null;
        snippet: string | null;
        from_email: string | null;
        from_name: string | null;
        to_emails: string[] | null;
        sent_at: string | null;
      }>();
      for (const m of messageResult.data ?? []) {
        const id = m.email_candidate_id as string | null;
        if (id && !messagesByPerson.has(id)) messagesByPerson.set(id, m as never);
      }

      const resumesByPerson = new Map<string, { file_name: string | null; extracted_text: string | null }>();
      for (const r of resumeResult.data ?? []) {
        const id = r.email_candidate_id as string | null;
        if (id && !resumesByPerson.has(id)) resumesByPerson.set(id, r as never);
      }

      const rows = archived.flatMap((p) => {
        const sourceMessage = messagesByPerson.get(p.id as string);
        const sourceResume = resumesByPerson.get(p.id as string);
        const bodyText = cleanBodyText(`${sourceMessage?.subject ?? ""}\n${sourceMessage?.snippet ?? ""}`);
        const docText = sourceResume?.extracted_text ?? "";
        const deterministic = extractDeterministic({
          fromEmail: sourceMessage?.from_email ?? null,
          fromName: sourceMessage?.from_name ?? null,
          cleanBody: bodyText,
          docText,
          primaryFileName: sourceResume?.file_name ?? null,
        }).fields;
        const safeStoredIdentity = sanitizeCandidateIdentity(
          { name: p.name, email: p.email, phone: p.phone },
          {
            fromEmail: sourceMessage?.from_email ?? null,
            fromName: sourceMessage?.from_name ?? null,
            bodyText,
            docText,
            hasAttachment: !!sourceResume,
          },
        );
        const skills = Array.from(new Set([...(deterministic.skills ?? []), ...((p.skills as string[] | null) ?? [])])).slice(0, 30);
        const extracted = {
          name: deterministic.name ?? safeStoredIdentity.name ?? null,
          email: deterministic.email ?? safeStoredIdentity.email ?? null,
          phone: deterministic.phone ?? safeStoredIdentity.phone ?? null,
          role: deterministic.role ?? p.role,
          location: deterministic.location ?? p.location,
          experience: deterministic.experience ?? p.experience,
          current_company: deterministic.current_company ?? p.current_company,
          skills,
          salary_min: deterministic.salary_min ?? p.salary_min,
          salary_max: deterministic.salary_max ?? p.salary_max,
          notes: null,
        };
        const haystack = [p.search_blob as string | null, docText, bodyText].filter(Boolean).join("\n");
        const ranked = rankItem(plan, {
          extracted: extracted as never,
          confidence: 90,
          hasResume: !!sourceResume,
          sentAt: (sourceMessage?.sent_at as string | null) ?? (p.last_email_at as string | null) ?? null,
          haystack,
        });
        // Same role gate as live Gmail hits: no occupation evidence, no result.
        if (!ranked.qualified) return [];
        return [{
          search_id: searchId,
          agency_id: agencyId,
          user_id: context.userId,
          gmail_message_id: `archive:${p.id}`,
          gmail_thread_id: null,
          subject: sourceMessage?.subject ?? extracted.role ?? extracted.name,
          snippet: haystack.slice(0, 240),
          from_email: sourceMessage?.from_email ?? null,
          from_name: sourceMessage?.from_name ?? null,
          sent_at: sourceMessage?.sent_at ?? p.last_email_at,
          score: ranked.score,
          score_parts: ranked.parts as never,
          confidence: 90,
          artifact_type: "candidate_resume",
          reason: "Already in your recruitment memory",
          extracted: extracted as never,
          resume_file_name: sourceResume?.file_name ?? null,
          origin: "archive",
          email_candidate_id: p.id,
          saved_candidate_id: (p.promoted_candidate_id as string | null) ?? null,
          saved_at: p.promoted_candidate_id ? new Date().toISOString() : null,
        }];
      });
      archiveHits = rows.length;
      if (rows.length) {
        await supabaseAdmin.from("email_search_hits").upsert(rows as never, { onConflict: "search_id,gmail_message_id" });
        await supabaseAdmin.from("email_searches").update({ hit_count: rows.length }).eq("id", searchId);
      }
    }

    return { searchId, plan, queries, archiveHits, reused: false };
  });

/** Run one slice of Gmail retrieval for a search. The client loops until done. */
export const runCandidateSearchBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ searchId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: search, error } = await supabaseAdmin
      .from("email_searches")
      .select("*")
      .eq("id", data.searchId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!search) throw new Error("Search not found");
    if (search.status !== "running") return { done: true, listed: 0, hydrated: 0, newHits: 0 };

    const { getValidAccessToken } = await import("../google-calendar.server");
    const conn = await getValidAccessToken(context.userId);
    if (!conn) throw new Error("Connect your Google account to search your mailbox.");
    if (!conn.scopes?.includes("gmail.readonly")) {
      throw new Error("Reconnect your Google account to grant read-only Gmail access.");
    }

    const { runSearchSlice } = await import("./run.server");
    try {
      return await runSearchSlice(search as never, conn.access_token, conn.google_email);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Search failed";
      await supabaseAdmin
        .from("email_searches")
        .update({ status: "failed", error: message, finished_at: new Date().toISOString() })
        .eq("id", data.searchId);
      throw new Error(message);
    }
  });

export const getCandidateSearch = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ searchId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: search } = await context.supabase
      .from("email_searches")
      .select("id,raw_query,status,listed_count,hydrated_count,hit_count,ai_calls,cache_hits,created_at,finished_at")
      .eq("id", data.searchId)
      .maybeSingle();
    const { data: hits } = await context.supabase
      .from("email_search_hits")
      .select(HIT_COLUMNS)
      .eq("search_id", data.searchId)
      .is("dismissed_at", null)
      .order("score", { ascending: false })
      .limit(100);
    return {
      search: (search as unknown as SearchStatus | null) ?? null,
      // One card per person: several emails from the same candidate collapse
      // into their best-scoring result.
      hits: dedupeHits((hits ?? []) as unknown as SearchHit[]),
    };
  });

export const listRecentSearches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("email_searches")
      .select("id,raw_query,status,hit_count,created_at")
      .order("created_at", { ascending: false })
      .limit(8);
    return (data ?? []) as { id: string; raw_query: string; status: string; hit_count: number; created_at: string }[];
  });

export const dismissSearchHit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ hitId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("email_search_hits")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", data.hitId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Explicit save: persist the search hit into recruitment memory and, when asked,
 * into the permanent candidate database.
 */
export const saveSearchHit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ hitId: z.string().uuid(), toCandidateDb: z.boolean().default(true) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: hit, error } = await supabaseAdmin
      .from("email_search_hits")
      .select("*")
      .eq("id", data.hitId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!hit) throw new Error("Search result not found");

    // Double-click / retry safe: an already-saved hit returns its existing links.
    if (hit.saved_at && hit.saved_email_candidate_id) {
      return {
        personId: hit.saved_email_candidate_id as string,
        candidateId: (hit.saved_candidate_id as string | null) ?? null,
      };
    }

    let personId = (hit.email_candidate_id as string | null) ?? null;
    if (!personId) {
      const payload = hit.pending_payload as unknown;
      if (!payload) throw new Error("This result can no longer be saved — run the search again.");
      const { upsertPersonFromPayload } = await import("../email-import.server");
      const res = await upsertPersonFromPayload(payload as never);
      personId = res.personId;
    }

    let candidateId: string | null = null;
    if (data.toCandidateDb) {
      const { linkOrCreateCandidate } = await import("../candidate-promote.server");
      const res = await linkOrCreateCandidate(personId, context.userId);
      candidateId = res.candidateId;
    }

    await supabaseAdmin
      .from("email_search_hits")
      .update({
        saved_email_candidate_id: personId,
        saved_candidate_id: candidateId,
        saved_at: new Date().toISOString(),
      })
      .eq("id", data.hitId)
      .eq("user_id", context.userId);

    return { personId, candidateId };
  });

/** Signed link to the resume attached to a search hit. */
export const getSearchHitResumeUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ hitId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: hit } = await context.supabase
      .from("email_search_hits")
      .select("resume_storage_path,email_candidate_id")
      .eq("id", data.hitId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!hit) throw new Error("Search result not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let path = (hit.resume_storage_path as string | null) ?? null;
    if (!path && hit.email_candidate_id) {
      const { data: latest } = await supabaseAdmin
        .from("email_resume_versions")
        .select("storage_path")
        .eq("email_candidate_id", hit.email_candidate_id as string)
        .eq("user_id", context.userId)
        .order("received_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      path = (latest?.storage_path as string | undefined) ?? null;
    }
    if (!path) throw new Error("No resume file for this result.");
    const { data: signed, error } = await supabaseAdmin.storage.from("documents").createSignedUrl(path, 300);
    if (error) throw new Error(error.message);
    return { url: signed!.signedUrl };
  });

export type HitSource = {
  kind: "email" | "attachment";
  fileName: string | null;
  subject: string | null;
  fromEmail: string | null;
  gmailThreadId: string | null;
  date: string | null;
  /** Short excerpt of the evidence text, when a document was parsed. */
  excerpt: string | null;
  /** Present for stored attachments so the UI can request a signed link. */
  storagePath: string | null;
};

/**
 * Every source (mail + stored attachments) behind one search result, so the
 * recruiter can inspect the evidence before adding the person.
 */
export const listSearchHitSources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ hitId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Read through the user's own RLS client: tenant scoping is not optional.
    const { data: hit } = await context.supabase
      .from("email_search_hits")
      .select(
        "id,subject,from_email,sent_at,gmail_thread_id,gmail_message_id,resume_file_name,resume_storage_path,email_candidate_id,snippet",
      )
      .eq("id", data.hitId)
      .maybeSingle();
    if (!hit) throw new Error("Search result not found");

    const sources: HitSource[] = [];
    const isArchive = String(hit.gmail_message_id ?? "").startsWith("archive:");
    if (hit.gmail_thread_id && !isArchive) {
      sources.push({
        kind: "email",
        fileName: null,
        subject: (hit.subject as string | null) ?? null,
        fromEmail: (hit.from_email as string | null) ?? null,
        gmailThreadId: hit.gmail_thread_id as string,
        date: (hit.sent_at as string | null) ?? null,
        excerpt: (hit.snippet as string | null) ?? null,
        storagePath: null,
      });
    }
    if (hit.resume_storage_path || hit.resume_file_name) {
      sources.push({
        kind: "attachment",
        fileName: (hit.resume_file_name as string | null) ?? "Resume",
        subject: (hit.subject as string | null) ?? null,
        fromEmail: (hit.from_email as string | null) ?? null,
        gmailThreadId: (isArchive ? null : (hit.gmail_thread_id as string | null)) ?? null,
        date: (hit.sent_at as string | null) ?? null,
        excerpt: null,
        storagePath: (hit.resume_storage_path as string | null) ?? null,
      });
    }

    const personId = hit.email_candidate_id as string | null;
    if (personId) {
      const { data: versions } = await context.supabase
        .from("email_resume_versions")
        .select("file_name,storage_path,received_at,extracted_text,email_message_id")
        .eq("email_candidate_id", personId)
        .order("received_at", { ascending: false })
        .limit(8);
      const messageIds = Array.from(
        new Set((versions ?? []).map((v) => v.email_message_id as string | null).filter(Boolean) as string[]),
      );
      let msgs: Record<string, { subject: string | null; from_email: string | null; gmail_thread_id: string | null }> = {};
      if (messageIds.length) {
        const { data: rows } = await context.supabase
          .from("email_messages")
          .select("id,subject,from_email,gmail_thread_id")
          .in("id", messageIds);
        msgs = Object.fromEntries((rows ?? []).map((r) => [r.id as string, r as never]));
      }
      for (const v of versions ?? []) {
        const path = v.storage_path as string | null;
        if (path && sources.some((s) => s.storagePath === path)) continue;
        const m = v.email_message_id ? msgs[v.email_message_id as string] : undefined;
        sources.push({
          kind: "attachment",
          fileName: (v.file_name as string | null) ?? "Resume",
          subject: m?.subject ?? null,
          fromEmail: m?.from_email ?? null,
          gmailThreadId: m?.gmail_thread_id ?? null,
          date: (v.received_at as string | null) ?? null,
          excerpt: ((v.extracted_text as string | null) ?? "").replace(/\s+/g, " ").trim().slice(0, 400) || null,
          storagePath: path,
        });
      }
    }

    return { sources };
  });

/** Signed link for one stored attachment behind a search result. */
export const getHitSourceUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ hitId: z.string().uuid(), storagePath: z.string().min(1).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // The path must belong to this user's own data — never sign an arbitrary path.
    const { data: hit } = await context.supabase
      .from("email_search_hits")
      .select("resume_storage_path,email_candidate_id")
      .eq("id", data.hitId)
      .maybeSingle();
    if (!hit) throw new Error("Search result not found");

    let allowed = hit.resume_storage_path === data.storagePath;
    if (!allowed && hit.email_candidate_id) {
      const { data: v } = await context.supabase
        .from("email_resume_versions")
        .select("id")
        .eq("email_candidate_id", hit.email_candidate_id as string)
        .eq("storage_path", data.storagePath)
        .maybeSingle();
      allowed = !!v;
    }
    if (!allowed) throw new Error("This file is not part of this result.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage.from("documents").createSignedUrl(data.storagePath, 300);
    if (error) throw new Error(error.message);
    return { url: signed!.signedUrl };
  });