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
    if (run.status !== "running") return { done: true, scanned: 0, newPeople: [] };

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
        "id,status,google_email,date_from,date_to,labels,emails_scanned,resume_emails,people_found,people_enriched,duplicates_merged,failures,failure_log,created_at,finished_at",
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
      })
      .partial()
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("email_candidates")
      .select(
        "id,name,email,phone,location,role,current_company,experience,skills,salary_min,salary_max,notes,resume_count,email_count,first_email_at,last_email_at,promoted_candidate_id,created_at",
      )
      .order("last_email_at", { ascending: false, nullsFirst: false })
      .limit(300);

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
          "id,name,email,phone,location,role,current_company,experience,skills,salary_min,salary_max,notes,resume_count,email_count,first_email_at,last_email_at,promoted_candidate_id,created_at",
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

    const { data: created, error: cErr } = await supabase
      .from("candidates")
      .insert({
        agency_id: person.agency_id as string,
        name: person.name as string,
        email: (person.email as string | null) ?? null,
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