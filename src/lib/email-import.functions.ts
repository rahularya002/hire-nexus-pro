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
      .object({ status: z.enum(["needs_review", "skipped"]).default("needs_review") })
      .partial()
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("email_import_skips")
      .select(
        "id,subject,snippet,from_email,from_name,attachment_names,confidence,email_kind,artifact_type,reason,status,sent_at,created_at,pending_payload",
      )
      .eq("status", data.status ?? "needs_review")
      .order("confidence", { ascending: false })
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
