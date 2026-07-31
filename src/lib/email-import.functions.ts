import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ImportRun = {
  id: string;
  status: string;
  google_email: string | null;
  date_from: string | null;
  date_to: string | null;
  labels: string[];
  emails_scanned: number;
  resume_emails: number;
  people_found: number;
  people_enriched: number;
  duplicates_merged: number;
  failures: number;
  skipped_non_resume: number;
  needs_review: number;
  skipped_noise: number;
  ai_calls: number;
  cache_hits: number;
  auto_imported: number;
  tokens_estimated: number;
  failure_log: { message: string }[];
  created_at: string;
  finished_at: string | null;
};

export type ArchivePerson = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  role: string | null;
  current_company: string | null;
  experience: string | null;
  skills: string[];
  salary_min: number | null;
  salary_max: number | null;
  notes: string | null;
  resume_count: number;
  email_count: number;
  first_email_at: string | null;
  last_email_at: string | null;
  promoted_candidate_id: string | null;
  created_at: string;
  confidence: number;
  review_status: string;
  email_kind: string | null;
  artifact_type?: string | null;
  classification_reason: string | null;
  ai_summary?: string | null;
  enriched_at?: string | null;
};

export type ReviewItem = {
  id: string;
  subject: string | null;
  snippet: string | null;
  from_email: string | null;
  from_name: string | null;
  attachment_names: string[];
  confidence: number;
  email_kind: string | null;
  artifact_type?: string | null;
  reason: string | null;
  status: string;
  sent_at: string | null;
  created_at: string;
  has_payload: boolean;
};

async function callerAgency(supabase: any, userId: string) {
  const { data } = await supabase
    .from("agency_members")
    .select("agency_id")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.agency_id as string | undefined) ?? null;
}

export const listGmailLabels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getValidAccessToken } = await import("./google-calendar.server");
    const conn = await getValidAccessToken(context.userId);
    if (!conn) return { connected: false, gmail: false, labels: [] as { id: string; name: string }[] };
    if (!conn.scopes?.includes("gmail.readonly")) {
      return { connected: true, gmail: false, labels: [] as { id: string; name: string }[] };
    }
    const { listLabels } = await import("./gmail.server");
    const labels = await listLabels(conn.access_token);
    return {
      connected: true,
      gmail: true,
      labels: labels.map((l) => ({ id: l.id, name: l.name })),
    };
  });

export const startImportRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        dateFrom: z.string().nullable().optional(),
        dateTo: z.string().nullable().optional(),
        labels: z.array(z.string().max(200)).max(50).default([]),
        exclusions: z.array(z.string().max(200)).max(50).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const agencyId = await callerAgency(context.supabase, context.userId);
    if (!agencyId) throw new Error("You must belong to an agency to import email history.");

    const { getValidAccessToken } = await import("./google-calendar.server");
    const conn = await getValidAccessToken(context.userId);
    if (!conn) throw new Error("Connect your Google account first.");
    if (!conn.scopes?.includes("gmail.readonly")) {
      throw new Error("Reconnect your Google account to grant read-only Gmail access.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Only one active run per user.
    await supabaseAdmin
      .from("email_import_runs")
      .update({ status: "cancelled", finished_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .in("status", ["running", "paused"]);

    const { data: run, error } = await supabaseAdmin
      .from("email_import_runs")
      .insert({
        agency_id: agencyId,
        user_id: context.userId,
        google_email: conn.google_email,
        status: "running",
        date_from: data.dateFrom ?? null,
        date_to: data.dateTo ?? null,
        labels: data.labels,
        exclusions: data.exclusions,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { runId: run!.id as string };
  });

export const processImportBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ runId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: run, error } = await supabaseAdmin
      .from("email_import_runs")
      .select("*")
      .eq("id", data.runId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!run) throw new Error("Import run not found");
    if (run.status !== "running")
      return { done: true, scanned: 0, skipped: 0, needsReview: 0, newPeople: [] as { id: string; name: string; email: string | null }[] };

    const { getValidAccessToken } = await import("./google-calendar.server");
    const conn = await getValidAccessToken(context.userId);
    if (!conn) throw new Error("Google connection lost. Reconnect and start again.");

    const { processRunBatch } = await import("./email-import.server");
    try {
      return await processRunBatch(run as any, conn.access_token);
    } catch (e) {
      await supabaseAdmin
        .from("email_import_runs")
        .update({
          status: "failed",
          error: e instanceof Error ? e.message : "Import failed",
          finished_at: new Date().toISOString(),
        })
        .eq("id", run.id);
      throw e;
    }
  });

export const getImportProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("email_import_runs")
      .select(
        "id,status,google_email,date_from,date_to,labels,emails_scanned,resume_emails,people_found,people_enriched,duplicates_merged,failures,skipped_non_resume,needs_review,skipped_noise,ai_calls,cache_hits,auto_imported,tokens_estimated,failure_log,created_at,finished_at",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as unknown as ImportRun | null) ?? null;
  });

export const cancelImportRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ runId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("email_import_runs")
      .update({ status: "paused" })
      .eq("id", data.runId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resumeImportRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ runId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("email_import_runs")
      .update({ status: "running" })
      .eq("id", data.runId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listEmailCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        search: z.string().max(200).optional(),
        skill: z.string().max(80).optional(),
        location: z.string().max(120).optional(),
        contactedWithinDays: z.number().int().positive().max(3650).nullable().optional(),
        mine: z.boolean().optional(),
        reviewStatus: z.enum(["imported", "needs_review", "rejected", "all"]).optional(),
        artifact: z.string().max(40).optional(),
      })
      .partial()
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("email_candidates")
      .select(
        "id,name,email,phone,location,role,current_company,experience,skills,salary_min,salary_max,notes,resume_count,email_count,first_email_at,last_email_at,promoted_candidate_id,created_at,confidence,review_status,email_kind,classification_reason,ai_summary,enriched_at,artifact_type",
      )
      .order("last_email_at", { ascending: false, nullsFirst: false })
      .limit(300);

    const rs = data.reviewStatus ?? "imported";
    if (rs !== "all") q = q.eq("review_status", rs);
    if (data.artifact && data.artifact !== "all") q = q.eq("artifact_type", data.artifact);
    if (data.mine) q = q.eq("user_id", context.userId);
    if (data.search?.trim()) {
      const s = data.search.trim().replace(/[%,]/g, " ");
      q = q.or(`name.ilike.%${s}%,email.ilike.%${s}%,search_blob.ilike.%${s}%`);
    }
    if (data.location?.trim()) q = q.ilike("location", `%${data.location.trim()}%`);
    if (data.skill?.trim()) q = q.contains("skills", [data.skill.trim()]);
    if (data.contactedWithinDays) {
      const since = new Date(Date.now() - data.contactedWithinDays * 86_400_000).toISOString();
      q = q.gte("last_email_at", since);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as ArchivePerson[];
  });

export const getEmailCandidate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: person, error: pErr }, { data: msgs }, { data: resumes }] = await Promise.all([
      supabase
        .from("email_candidates")
        .select(
          "id,name,email,phone,location,role,current_company,experience,skills,salary_min,salary_max,notes,resume_count,email_count,first_email_at,last_email_at,promoted_candidate_id,created_at,confidence,review_status,email_kind,classification_reason,ai_summary,enriched_at,artifact_type",
        )
        .eq("id", data.id)
        .maybeSingle(),
      supabase
        .from("email_messages")
        .select("id,subject,snippet,from_email,from_name,to_emails,direction,sent_at")
        .eq("email_candidate_id", data.id)
        .order("sent_at", { ascending: false })
        .limit(200),
      supabase
        .from("email_resume_versions")
        .select("id,file_name,mime,size_bytes,received_at,created_at")
        .eq("email_candidate_id", data.id)
        .order("received_at", { ascending: false })
        .limit(50),
    ]);
    if (pErr) throw new Error(pErr.message);
    if (!person) throw new Error("Not found");
    return {
      person: person as unknown as ArchivePerson,
      messages: (msgs ?? []) as unknown as {
        id: string;
        subject: string | null;
        snippet: string | null;
        from_email: string | null;
        from_name: string | null;
        to_emails: string[];
        direction: string;
        sent_at: string | null;
      }[],
      resumes: (resumes ?? []) as unknown as {
        id: string;
        file_name: string;
        mime: string | null;
        size_bytes: number | null;
        received_at: string | null;
        created_at: string;
      }[],
    };
  });

export const getArchiveResumeUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ resumeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("email_resume_versions")
      .select("storage_path")
      .eq("id", data.resumeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row?.storage_path) return { url: null as string | null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("documents")
      .createSignedUrl(row.storage_path as string, 60 * 60);
    if (sErr) throw new Error(sErr.message);
    return { url: signed?.signedUrl ?? null };
  });

/** Deliberate, per-record promotion into the main candidate database. */
export const promoteArchivePerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: person, error } = await supabase
      .from("email_candidates")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!person) throw new Error("Archived person not found");
    if (person.promoted_candidate_id) {
      return { candidateId: person.promoted_candidate_id as string, alreadyPromoted: true };
    }

    const { data: latest } = await supabase
      .from("email_resume_versions")
      .select("storage_path")
      .eq("email_candidate_id", data.id)
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const personEmail = ((person.email as string | null) ?? "").trim().toLowerCase() || null;

    // candidates.email is globally unique — link to the existing record instead of failing.
    if (personEmail) {
      const { data: existing } = await supabase
        .from("candidates")
        .select("id")
        .ilike("email", personEmail)
        .maybeSingle();
      if (existing) {
        await supabase
          .from("email_candidates")
          .update({ promoted_candidate_id: existing.id as string })
          .eq("id", data.id);
        return { candidateId: existing.id as string, alreadyPromoted: true };
      }
    }

    const { data: created, error: cErr } = await supabase
      .from("candidates")
      .insert({
        agency_id: person.agency_id as string,
        name: person.name as string,
        email: personEmail,
        phone: (person.phone as string | null) ?? null,
        role: (person.role as string | null) ?? null,
        experience: (person.experience as string | null) ?? null,
        location: (person.location as string | null) ?? null,
        current_company: (person.current_company as string | null) ?? null,
        skills: (person.skills as string[] | null) ?? [],
        salary_min: (person.salary_min as number | null) ?? null,
        salary_max: (person.salary_max as number | null) ?? null,
        notes: (person.notes as string | null) ?? null,
        resume_url: (latest?.storage_path as string | undefined) ?? null,
        source: "inbound",
      })
      .select("id")
      .single();
    if (cErr) throw new Error(cErr.message);

    await supabase
      .from("email_candidates")
      .update({ promoted_candidate_id: created!.id as string })
      .eq("id", data.id);

    return { candidateId: created!.id as string, alreadyPromoted: false };
  });

/** Re-score already-imported archive rows and delete obvious non-candidates. */
export const listReviewItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        status: z.enum(["needs_review", "skipped"]).default("needs_review"),
        artifact: z.string().max(40).optional(),
        contextOnly: z.boolean().optional(),
      })
      .partial()
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("email_import_skips")
      .select(
        "id,subject,snippet,from_email,from_name,attachment_names,confidence,email_kind,artifact_type,reason,status,sent_at,created_at,pending_payload",
      )
      .eq("status", data.status ?? "needs_review");
    if (data.artifact && data.artifact !== "all") query = query.eq("artifact_type", data.artifact);
    if (data.contextOnly) {
      query = query.in("artifact_type", ["recruitment_conversation", "job_description", "interview_feedback"]);
    }
    const { data: rows, error } = await query
      .order("sent_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id as string,
      subject: r.subject as string | null,
      snippet: r.snippet as string | null,
      from_email: r.from_email as string | null,
      from_name: r.from_name as string | null,
      attachment_names: (r.attachment_names as string[] | null) ?? [],
      confidence: (r.confidence as number) ?? 0,
      email_kind: r.email_kind as string | null,
      artifact_type: r.artifact_type as string | null,
      reason: r.reason as string | null,
      status: r.status as string,
      sent_at: r.sent_at as string | null,
      created_at: r.created_at as string,
      has_payload: !!r.pending_payload,
    })) as ReviewItem[];
  });

/** Recruiter confirms a borderline email really is recruitment — create the person. */
export const approveReviewItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("email_import_skips")
      .select("id,pending_payload,confidence")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Review item not found");
    const payload = (row.pending_payload ?? null) as Record<string, unknown> | null;
    if (!payload) throw new Error("This email has no saved content to import. Re-run the import instead.");

    const { upsertPersonFromPayload } = await import("./email-import.server");
    const merged = Object.assign({}, payload, { user_id: context.userId });
    const res = await upsertPersonFromPayload(merged as never);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("email_import_skips")
      .update({ status: "approved", pending_payload: null })
      .eq("id", data.id);
    return { personId: res.personId, name: res.name, merged: res.merged };
  });

/** Recruiter confirms a borderline email is not recruitment. */
export const rejectReviewItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("email_import_skips")
      .update({ status: "rejected", pending_payload: null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cleanNonCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return rescoreImpl(context);
  });

const BANDS = {
  likely: { min: 70, max: 100 },
  borderline: { min: 40, max: 69 },
  weak: { min: 0, max: 39 },
} as const;
export type ReviewBand = keyof typeof BANDS;

/**
 * Paginated, filterable review queue. Sorted strongest-first by default so a
 * recruiter with 15 minutes spends them on the items most likely to be people.
 */
export const listReviewQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        search: z.string().max(200).optional(),
        band: z.string().max(20).optional(),
        artifact: z.string().max(40).optional(),
        hasResume: z.boolean().optional(),
        mine: z.boolean().optional(),
        withinDays: z.number().optional(),
        sort: z.string().max(20).optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      })
      .partial()
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const limit = Math.max(1, Math.min(200, Math.round(data.limit ?? 50)));
    const offset = Math.max(0, Math.round(data.offset ?? 0));
    const sort = data.sort === "newest" || data.sort === "oldest" ? data.sort : "confidence";

    const base = () => {
      let q = context.supabase
        .from("email_import_skips")
        .select(
          "id,subject,snippet,from_email,from_name,attachment_names,confidence,email_kind,artifact_type,reason,status,sent_at,created_at,pending_payload,gmail_thread_id",
          { count: "exact" },
        )
        .eq("status", "needs_review");
      const band = data.band && data.band !== "all" ? BANDS[data.band as ReviewBand] : null;
      if (band) q = q.gte("confidence", band.min).lte("confidence", band.max);
      if (data.artifact && data.artifact !== "all") q = q.eq("artifact_type", data.artifact);
      if (data.hasResume) q = q.not("attachment_names", "eq", "{}");
      if (data.mine) q = q.eq("user_id", context.userId);
      if (data.withinDays && data.withinDays > 0) {
        q = q.gte("sent_at", new Date(Date.now() - data.withinDays * 86_400_000).toISOString());
      }
      const s = (data.search ?? "").trim();
      if (s) {
        const like = `%${s.replace(/[%,]/g, " ")}%`;
        q = q.or(
          `subject.ilike.${like},from_email.ilike.${like},from_name.ilike.${like},snippet.ilike.${like}`,
        );
      }
      return q;
    };

    let query = base();
    query =
      sort === "newest"
        ? query.order("sent_at", { ascending: false, nullsFirst: false })
        : sort === "oldest"
          ? query.order("sent_at", { ascending: true, nullsFirst: false })
          : query.order("confidence", { ascending: false }).order("sent_at", { ascending: false, nullsFirst: false });

    const { data: rows, error, count } = await query.range(offset, offset + limit - 1);
    if (error) throw new Error(error.message);

    // Exact band counts (head-only), so the tab can say "12 likely of 204".
    const countFor = async (min?: number, max?: number) => {
      let q = context.supabase
        .from("email_import_skips")
        .select("id", { count: "exact", head: true })
        .eq("status", "needs_review");
      if (min != null) q = q.gte("confidence", min);
      if (max != null) q = q.lte("confidence", max);
      const { count: c } = await q;
      return c ?? 0;
    };
    const [likely, borderline, weak, total] = await Promise.all([
      countFor(BANDS.likely.min, BANDS.likely.max),
      countFor(BANDS.borderline.min, BANDS.borderline.max),
      countFor(BANDS.weak.min, BANDS.weak.max),
      countFor(),
    ]);
    const bandCounts = { likely, borderline, weak, total };

    const items = (rows ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      subject: (r.subject as string | null) ?? null,
      snippet: (r.snippet as string | null) ?? null,
      from_email: (r.from_email as string | null) ?? null,
      from_name: (r.from_name as string | null) ?? null,
      attachment_names: (r.attachment_names as string[] | null) ?? [],
      confidence: (r.confidence as number) ?? 0,
      email_kind: (r.email_kind as string | null) ?? null,
      artifact_type: (r.artifact_type as string | null) ?? null,
      reason: (r.reason as string | null) ?? null,
      status: r.status as string,
      sent_at: (r.sent_at as string | null) ?? null,
      created_at: r.created_at as string,
      has_payload: !!r.pending_payload,
      thread_id: (r.gmail_thread_id as string | null) ?? null,
    })) as (ReviewItem & { thread_id: string | null })[];

    return { items, matched: count ?? items.length, bands: bandCounts };
  });

/** Approve or dismiss many review items in one action. */
export const bulkReviewDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).max(500), approve: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!data.ids.length) return { approved: 0, dismissed: 0, failed: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!data.approve) {
      const { error } = await context.supabase
        .from("email_import_skips")
        .update({ status: "rejected", pending_payload: null })
        .in("id", data.ids);
      if (error) throw new Error(error.message);
      return { approved: 0, dismissed: data.ids.length, failed: 0 };
    }

    const { data: rows, error } = await context.supabase
      .from("email_import_skips")
      .select("id,pending_payload")
      .in("id", data.ids);
    if (error) throw new Error(error.message);

    const { upsertPersonFromPayload } = await import("./email-import.server");
    let approved = 0;
    let failed = 0;
    for (const row of (rows ?? []) as { id: string; pending_payload: Record<string, unknown> | null }[]) {
      if (!row.pending_payload) {
        failed++;
        continue;
      }
      try {
        await upsertPersonFromPayload(
          Object.assign({}, row.pending_payload, { user_id: context.userId }) as never,
        );
        await supabaseAdmin
          .from("email_import_skips")
          .update({ status: "approved", pending_payload: null })
          .eq("id", row.id);
        approved++;
      } catch {
        failed++;
      }
    }
    return { approved, dismissed: 0, failed };
  });

/**
 * Re-decide every queued item against the current thresholds using the payload
 * we already stored — no Gmail calls, no AI calls. Anything that now clears the
 * auto-accept bar is imported so the queue shrinks to genuine judgement calls.
 */
export const retriageReviewQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("email_import_skips")
      .select("id,confidence,artifact_type,attachment_names,pending_payload")
      .eq("status", "needs_review")
      .limit(1000);
    if (error) throw new Error(error.message);

    const { CANDIDATE_AUTO_ACCEPT_THRESHOLD } = await import("./pipeline/config");
    const { upsertPersonFromPayload } = await import("./email-import.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let imported = 0;
    let kept = 0;
    for (const r of (rows ?? []) as {
      id: string;
      confidence: number | null;
      artifact_type: string | null;
      attachment_names: string[] | null;
      pending_payload: Record<string, unknown> | null;
    }[]) {
      const candidateArtifact =
        r.artifact_type === "candidate_profile" || r.artifact_type === "candidate_plus_conversation";
      const payload = r.pending_payload;
      const extracted = (payload?.extracted ?? null) as { name?: string | null } | null;
      const trusted =
        candidateArtifact &&
        (r.confidence ?? 0) >= CANDIDATE_AUTO_ACCEPT_THRESHOLD &&
        (!!extracted?.name || (r.attachment_names ?? []).length > 0);
      if (!payload || !trusted) {
        kept++;
        continue;
      }
      try {
        await upsertPersonFromPayload(Object.assign({}, payload, { user_id: context.userId }) as never);
        await supabaseAdmin
          .from("email_import_skips")
          .update({ status: "approved", pending_payload: null })
          .eq("id", r.id);
        imported++;
      } catch {
        kept++;
      }
    }
    return { imported, kept };
  });

/**
 * Re-read the stored mail (sender, subject, snippets) plus the extracted resume
 * text for every archived person and re-score them with the classifier, so rows
 * imported before scoring existed get a real confidence and are demoted when
 * they turn out to be bank / wallet / billing mail.
 */
export const rescoreArchive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => rescoreImpl(context));

/* eslint-disable @typescript-eslint/no-explicit-any */
async function rescoreImpl(context: { supabase: any; userId: string }) {
  const { data: rows, error } = await context.supabase
    .from("email_candidates")
    .select("id,name,email,role,notes,skills,promoted_candidate_id,review_status")
    .limit(300);
  if (error) throw new Error(error.message);

  const { classifyItem } = await import("./pipeline/classify.server");
  const { cleanBodyText, extractDeterministic, sha256Text } = await import("./pipeline/normalize.server");
  const { emptyMetrics } = await import("./pipeline/types");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const metrics = emptyMetrics();

  let imported = 0;
  let review = 0;
  let rejected = 0;

  for (const r of (rows ?? []) as any[]) {
    const id = r.id as string;
    const [{ data: msgs }, { data: resumes }] = await Promise.all([
      context.supabase
        .from("email_messages")
        .select("subject,snippet,from_email,from_name,to_emails")
        .eq("email_candidate_id", id)
        .order("sent_at", { ascending: false })
        .limit(5),
      context.supabase
        .from("email_resume_versions")
        .select("file_name,extracted_text,content_sha256")
        .eq("email_candidate_id", id)
        .order("received_at", { ascending: false })
        .limit(2),
    ]);

    const first = (msgs ?? [])[0] as
      | { subject: string | null; snippet: string | null; from_email: string | null; from_name: string | null; to_emails: string[] | null }
      | undefined;
    const bodyText = cleanBodyText(
      ((msgs ?? []) as any[]).map((m) => `${m.subject ?? ""}\n${m.snippet ?? ""}`).join("\n\n"),
    );
    const docText = ((resumes ?? []) as any[])
      .map((x) => (x.extracted_text as string | null) ?? "")
      .join("\n");
    const attachmentNames = ((resumes ?? []) as any[]).map((x) => x.file_name as string);
    const hashes: string[] = [];
    for (const x of (resumes ?? []) as any[]) {
      const h = (x.content_sha256 as string | null) ?? null;
      if (h) hashes.push(h);
    }
    if (!hashes.length && docText) hashes.push(await sha256Text(docText.slice(0, 4000)));

    const fromEmail = first?.from_email ?? (r.email as string | null);
    const det = extractDeterministic({
      fromEmail,
      fromName: first?.from_name ?? (r.name as string | null),
      cleanBody: bodyText,
      docText,
      primaryFileName: attachmentNames[0] ?? null,
    });

    const cls = await classifyItem({
      userId: context.userId,
      signal: {
        fromEmail,
        fromName: first?.from_name ?? (r.name as string | null),
        toEmails: first?.to_emails ?? [],
        myEmail: null,
        subject: first?.subject ?? null,
        bodyText,
        attachmentNames,
        docText,
        threadKnown: false,
      },
      deterministic: det.fields,
      gaps: det.gaps,
      attachmentHashes: hashes.slice(0, 1),
      metrics,
    });

    const status =
      r.promoted_candidate_id
        ? "imported"
        : cls.decision === "import"
          ? "imported"
          : cls.decision === "review"
            ? "needs_review"
            : "rejected";
    if (status === "imported") imported++;
    else if (status === "needs_review") review++;
    else rejected++;

    await supabaseAdmin
      .from("email_candidates")
      .update({
        confidence: r.promoted_candidate_id ? Math.max(cls.confidence, 80) : cls.confidence,
        review_status: status,
        email_kind: cls.kind,
        artifact_type: cls.artifact,
        classification_reason: cls.reason,
        signals: cls.signals as never,
      })
      .eq("id", id);
  }

  return {
    scored: (rows ?? []).length,
    imported,
    review,
    rejected,
    removed: rejected,
    aiCalls: metrics.aiCalls,
    cacheHits: metrics.cacheHits,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const deleteRejectedArchive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("email_candidates")
      .select("id")
      .eq("review_status", "rejected")
      .is("promoted_candidate_id", null)
      .limit(2000);
    if (error) throw new Error(error.message);
    const doomed = (rows ?? []).map((r) => r.id as string);
    if (doomed.length === 0) return { removed: 0 };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("email_resume_versions").delete().in("email_candidate_id", doomed);
    await supabaseAdmin.from("email_messages").delete().in("email_candidate_id", doomed);
    const { error: dErr } = await supabaseAdmin.from("email_candidates").delete().in("id", doomed);
    if (dErr) throw new Error(dErr.message);
    return { removed: doomed.length };
  });

/**
 * ENRICHMENT — explicit only. Never runs during import and never on profile open;
 * a recruiter has to ask for it, and the result is stored so it never repeats.
 */
export const enrichArchivePerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), force: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: person, error } = await context.supabase
      .from("email_candidates")
      .select("id,name,role,current_company,experience,location,skills,notes,ai_summary,enriched_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!person) throw new Error("Archived person not found");
    if (person.ai_summary && !data.force) {
      return { summary: person.ai_summary as string, cached: true };
    }

    const { data: resumes } = await context.supabase
      .from("email_resume_versions")
      .select("extracted_text")
      .eq("email_candidate_id", data.id)
      .order("received_at", { ascending: false })
      .limit(1);
    const docText = ((resumes ?? [])[0]?.extracted_text as string | null) ?? "";

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured for this workspace.");

    const { AI_MAX_DOC_CHARS } = await import("./pipeline/config");
    const profile = [
      `Name: ${person.name ?? ""}`,
      `Role: ${person.role ?? ""}`,
      `Company: ${person.current_company ?? ""}`,
      `Experience: ${person.experience ?? ""}`,
      `Location: ${person.location ?? ""}`,
      `Skills: ${((person.skills as string[] | null) ?? []).join(", ")}`,
      "",
      "--- RESUME TEXT ---",
      docText.slice(0, AI_MAX_DOC_CHARS),
    ].join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "system",
            content:
              "Write a tight recruiter-facing summary of this candidate in 3-4 sentences: seniority, core strengths, domain, and anything a recruiter should watch out for. Plain prose, no headings, no bullet points, no invented facts.",
          },
          { role: "user", content: profile },
        ],
      }),
    });
    if (res.status === 429) throw new Error("AI rate limit reached. Try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits to continue.");
    if (!res.ok) throw new Error(`AI request failed (${res.status}).`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const summary = (json.choices?.[0]?.message?.content ?? "").trim();
    if (!summary) throw new Error("The model returned an empty summary.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("email_candidates")
      .update({ ai_summary: summary, enriched_at: new Date().toISOString() })
      .eq("id", data.id);

    return { summary, cached: false };
  });

/** Recruiter override: move an archived person back (or out) of the main archive list. */
export const setArchiveReviewStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        reviewStatus: z.enum(["imported", "needs_review", "rejected"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("email_candidates")
      .update({ review_status: data.reviewStatus })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Stop the active run for good (paused runs can still be stopped). */
export const stopImportRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ runId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("email_import_runs")
      .update({ status: "cancelled", finished_at: new Date().toISOString() })
      .eq("id", data.runId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Recovery history for the "import history" drawer. */
export const listImportRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("email_import_runs")
      .select(
        "id,status,google_email,date_from,date_to,emails_scanned,people_found,people_enriched,duplicates_merged,needs_review,skipped_noise,failures,created_at,finished_at",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as {
      id: string;
      status: string;
      google_email: string | null;
      date_from: string | null;
      date_to: string | null;
      emails_scanned: number;
      people_found: number;
      people_enriched: number;
      duplicates_merged: number;
      needs_review: number;
      skipped_noise: number;
      failures: number;
      created_at: string;
      finished_at: string | null;
    }[];
  });

/**
 * Wipe this recruiter's recovered archive. People already promoted to the main
 * candidate database are kept — their candidate record stays either way, but we
 * never silently drop the archive row that links them.
 */
export const clearEmailArchive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("email_candidates")
      .select("id")
      .is("promoted_candidate_id", null)
      .limit(5000);
    if (error) throw new Error(error.message);
    const doomed = (rows ?? []).map((r) => r.id as string);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (doomed.length) {
      await supabaseAdmin.from("email_resume_versions").delete().in("email_candidate_id", doomed);
      await supabaseAdmin.from("email_messages").delete().in("email_candidate_id", doomed);
      const { error: dErr } = await supabaseAdmin.from("email_candidates").delete().in("id", doomed);
      if (dErr) throw new Error(dErr.message);
    }
    await supabaseAdmin.from("email_import_skips").delete().eq("user_id", context.userId);
    return { removed: doomed.length };
  });
