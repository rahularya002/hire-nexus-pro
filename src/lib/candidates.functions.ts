import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const APPLICATION_STAGES = [
  "sourcing",
  "recruiter_shortlist",
  "shared_with_client",
  "client_shortlist",
  "client_rejected",
  "on_hold",
  "interview_scheduled",
  "rounds",
  "offered",
  "closed",
] as const;
export type ApplicationStage = (typeof APPLICATION_STAGES)[number];

export const STAGE_LABEL: Record<ApplicationStage, string> = {
  sourcing: "Sourcing",
  recruiter_shortlist: "Recruiter Shortlist",
  shared_with_client: "Shared with Client",
  client_shortlist: "Client Shortlist",
  client_rejected: "Rejected by Client",
  on_hold: "On Hold",
  interview_scheduled: "Interview Scheduled",
  rounds: "Rounds",
  offered: "Offered",
  closed: "Closed",
};

export const CLIENT_VISIBLE_STAGES: ApplicationStage[] = [
  "shared_with_client",
  "client_shortlist",
  "client_rejected",
  "on_hold",
  "interview_scheduled",
  "rounds",
  "offered",
  "closed",
];

export const CANDIDATE_STATUSES = [
  "new",
  "contacted",
  "screening",
  "shortlisted",
  "submitted",
  "placed",
  "on_hold",
  "rejected",
] as const;
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export const CANDIDATE_STATUS_LABEL: Record<CandidateStatus, string> = {
  new: "New",
  contacted: "Contacted",
  screening: "Screening",
  shortlisted: "Shortlisted",
  submitted: "Submitted",
  placed: "Placed",
  on_hold: "On hold",
  rejected: "Rejected",
};

export type CandidateRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  experience: string | null;
  location: string | null;
  current_company: string | null;
  skills: string[];
  resume_url: string | null;
  linkedin_url: string | null;
  salary: string | null;
  salary_min: number | null;
  salary_max: number | null;
  source: "manual" | "scout" | "referral" | "database" | "inbound";
  notes: string | null;
  created_at: string;
  updated_at: string;
  source_client_id: string | null;
  source_client?: { id: string; name: string; color: string | null } | null;
  // Canonical candidate-intelligence fields.
  current_ctc: number | null;
  expected_ctc: number | null;
  relevant_experience: string | null;
  previous_companies: string[];
  industry: string | null;
  education: string | null;
  notice_period: string | null;
  availability: string | null;
  last_contacted_at: string | null;
  owner_id: string | null;
  status: CandidateStatus;
};


export type ApplicationRow = {
  id: string;
  candidate_id: string;
  position_id: string;
  stage: ApplicationStage;
  match_score: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  candidate?: CandidateRow | null;
  position?: {
    id: string;
    title: string;
    location: string | null;
    status: "open" | "in_progress" | "interviews" | "closed";
    client_id: string;
    client?: { id: string; name: string; color: string | null } | null;
  } | null;
};

/** Cleared inputs arrive as "" — treat them as null so format checks don't fire. */
const emptyToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), schema);

const candidateSchema = z.object({
  name: z.string().min(1).max(200),
  email: emptyToNull(z.string().email().max(200).optional().nullable()),
  phone: z.string().max(50).optional().nullable(),
  role: z.string().max(200).optional().nullable(),
  experience: z.string().max(100).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  current_company: z.string().max(200).optional().nullable(),
  skills: z.array(z.string().min(1).max(60)).max(40).optional(),
  // Stores either a full URL or a storage path (bucket/key) — signed on demand.
  resume_url: z.string().max(500).optional().nullable(),
  linkedin_url: emptyToNull(z.string().url().max(500).optional().nullable()),
  salary: z.string().max(200).optional().nullable(),
  salary_min: z.number().nonnegative().max(1_000_000_000).optional().nullable(),
  salary_max: z.number().nonnegative().max(1_000_000_000).optional().nullable(),
  current_ctc: z.number().nonnegative().max(1_000_000_000).optional().nullable(),
  expected_ctc: z.number().nonnegative().max(1_000_000_000).optional().nullable(),
  relevant_experience: z.string().max(100).optional().nullable(),
  previous_companies: z.array(z.string().min(1).max(200)).max(30).optional(),
  industry: z.string().max(200).optional().nullable(),
  education: z.string().max(500).optional().nullable(),
  notice_period: z.string().max(100).optional().nullable(),
  availability: z.string().max(200).optional().nullable(),
  last_contacted_at: emptyToNull(z.string().datetime().optional().nullable()),
  owner_id: z.string().uuid().optional().nullable(),
  status: z.enum(CANDIDATE_STATUSES).optional(),

  source: z.enum(["manual", "scout", "referral", "database", "inbound"]).optional(),
  notes: z.string().max(10_000).optional().nullable(),
  source_client_id: z.string().uuid().nullable().optional(),
});

function clean<T extends Record<string, any>>(o: T): T {
  const out: any = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === "" || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

async function logActivity(
  supabase: any,
  userId: string,
  payload: {
    kind: string;
    title: string;
    detail?: string | null;
    client_id?: string | null;
    position_id?: string | null;
    candidate_id?: string | null;
    application_id?: string | null;
    client_visible?: boolean;
  },
) {
  try {
    const { getUserAgencyId } = await import("@/lib/auth/agency");
    const agencyId = await getUserAgencyId(supabase, userId);
    if (!agencyId) return;
    await supabase
      .from("activities")
      .insert(clean({ ...payload, actor_id: userId, agency_id: agencyId }));
  } catch {
    // swallow — logging must never break primary mutation
  }
}

async function clientIdForPosition(supabase: any, positionId: string): Promise<string | null> {
  const { data } = await supabase
    .from("positions")
    .select("client_id")
    .eq("id", positionId)
    .maybeSingle();
  return (data?.client_id as string | undefined) ?? null;
}

export const listCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("candidates")
      .select("*, source_client:clients!candidates_source_client_id_fkey(id,name,color)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []) as CandidateRow[];
  });

export const getCandidateById = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("candidates")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row as CandidateRow | null;
  });

export const createCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => candidateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Duplicate detection — block on same email or phone (normalized).
    const normEmail = data.email?.trim().toLowerCase() || null;
    const normPhone = data.phone?.replace(/\D+/g, "") || null;
    if (normEmail || normPhone) {
      const orParts: string[] = [];
      if (normEmail) orParts.push(`email.ilike.${normEmail}`);
      if (normPhone && normPhone.length >= 7) orParts.push(`phone.ilike.%${normPhone.slice(-10)}%`);
      if (orParts.length > 0) {
        const { data: existing } = await supabase
          .from("candidates")
          .select("id,name,email,phone")
          .or(orParts.join(","))
          .limit(1);
        if (existing && existing.length > 0) {
          const dup = existing[0];
          const by = normEmail && dup.email?.toLowerCase() === normEmail ? "email" : "phone";
          throw new Error(`A candidate already exists with this ${by}: ${dup.name}`);
        }
      }
    }
    const { data: row, error } = await supabase
      .from("candidates")
      .insert(clean({ ...data, created_by: userId }) as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await logActivity(supabase, userId, {
      kind: "submission",
      title: `Candidate added: ${row.name}`,
      detail: row.role ?? null,
      candidate_id: row.id,
    });
    return row as CandidateRow;
  });

export const updateCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid() }).merge(candidateSchema.partial()).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...rest } = data;
    const { data: row, error } = await supabase
      .from("candidates")
      .update(clean(rest))
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await logActivity(supabase, userId, {
      kind: "note",
      title: `Candidate updated: ${row.name}`,
      candidate_id: row.id,
    });
    return row as CandidateRow;
  });

export const deleteCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("candidates")
      .select("name")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabase.from("candidates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logActivity(supabase, userId, {
      kind: "note",
      title: `Candidate removed${existing?.name ? `: ${existing.name}` : ""}`,
    });
    return { ok: true };
  });

export const listApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        positionId: z.string().uuid().optional(),
        candidateId: z.string().uuid().optional(),
        stages: z.array(z.enum(APPLICATION_STAGES)).optional(),
      })
      .optional()
      .parse(d) ?? {},
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("applications")
      .select(
        "*, candidate:candidates(*), position:positions(id,title,location,status,client_id, client:clients(id,name,color))",
      )
      .order("updated_at", { ascending: false })
      .limit(1000);
    if (data?.positionId) q = q.eq("position_id", data.positionId);
    if (data?.candidateId) q = q.eq("candidate_id", data.candidateId);
    if (data?.stages && data.stages.length > 0) q = q.in("stage", data.stages);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as ApplicationRow[];
  });

const applicationSchema = z.object({
  candidate_id: z.string().uuid(),
  position_id: z.string().uuid(),
  stage: z.enum(APPLICATION_STAGES).optional(),
  match_score: z.number().int().min(0).max(100).optional().nullable(),
  notes: z.string().max(10_000).optional().nullable(),
});

export const createApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => applicationSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("applications")
      .insert(clean({ ...data, created_by: userId }) as never)
      .select("*, candidate:candidates(name), position:positions(title, client_id)")
      .single();
    if (error) throw new Error(error.message);
    const stage = row.stage as ApplicationStage;
    await logActivity(supabase, userId, {
      kind: stage === "shared_with_client" ? "share" : "submission",
      title: `${row.candidate?.name ?? "Candidate"} → ${row.position?.title ?? "position"} (${STAGE_LABEL[stage] ?? stage})`,
      application_id: row.id,
      candidate_id: row.candidate_id,
      position_id: row.position_id,
      client_id: row.position?.client_id ?? null,
      client_visible: CLIENT_VISIBLE_STAGES.includes(stage),
    });
    return row as unknown as ApplicationRow;
  });

export const updateApplicationStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        stage: z.enum(APPLICATION_STAGES).optional(),
        match_score: z.number().int().min(0).max(100).optional().nullable(),
        notes: z.string().max(10_000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...rest } = data;
    const { data: row, error } = await supabase
      .from("applications")
      .update(clean(rest))
      .eq("id", id)
      .select("*, candidate:candidates(name), position:positions(title, client_id)")
      .single();
    if (error) throw new Error(error.message);
    if (data.stage) {
      const stage = row.stage as ApplicationStage;
      const kind =
        stage === "shared_with_client" ? "share"
        : stage === "offered" ? "offer"
        : stage === "closed" ? "closure"
        : "stage_change";
      await logActivity(supabase, userId, {
        kind,
        title: `${row.candidate?.name ?? "Candidate"} moved to ${STAGE_LABEL[stage] ?? stage}`,
        detail: row.position?.title ?? null,
        application_id: row.id,
        candidate_id: row.candidate_id,
        position_id: row.position_id,
        client_id: row.position?.client_id ?? null,
        client_visible: CLIENT_VISIBLE_STAGES.includes(stage),
      });
    }
    return row as unknown as ApplicationRow;
  });

export const deleteApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("applications").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Attach an already-uploaded CV (in the `documents` bucket) to an existing candidate.
 * Sets `candidates.resume_url` and inserts a matching row in `documents`.
 */
export const attachCvToCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        candidateId: z.string().uuid(),
        storagePath: z.string().min(1).max(500),
        fileName: z.string().min(1).max(255),
        mime: z.string().max(200).nullable().optional(),
        sizeBytes: z.number().int().min(0).nullable().optional(),
        overwrite: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing, error: gErr } = await supabase
      .from("candidates")
      .select("id,name,resume_url")
      .eq("id", data.candidateId)
      .maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!existing) throw new Error("Candidate not found");

    if (existing.resume_url && !data.overwrite) {
      // Clean up the just-uploaded file so we don't leak storage.
      try { await supabase.storage.from("documents").remove([data.storagePath]); } catch { /* ignore */ }
      return { status: "already_has_cv" as const, candidateId: existing.id, name: existing.name as string };
    }

    const { error: uErr } = await supabase
      .from("candidates")
      .update({ resume_url: data.storagePath })
      .eq("id", data.candidateId);
    if (uErr) throw new Error(uErr.message);

    try {
      await supabase.from("documents").insert(
        clean({
          name: data.fileName,
          kind: "resume",
          candidate_id: data.candidateId,
          storage_bucket: "documents",
          storage_path: data.storagePath,
          mime: data.mime ?? null,
          size_bytes: data.sizeBytes ?? null,
          uploaded_by: userId,
        }) as never,
      );
    } catch { /* non-fatal */ }

    await logActivity(supabase, userId, {
      kind: "note",
      title: `CV attached: ${existing.name}`,
      candidate_id: existing.id,
    });

    return { status: "attached" as const, candidateId: existing.id, name: existing.name as string };
  });

/**
 * Return a temporary signed URL for a candidate's CV.
 * `resume_url` may be either a full https URL (used as-is) or a storage path
 * inside the `documents` bucket (signed for 1 hour).
 */
export const getResumeSignedUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { candidateId: string }) =>
    z.object({ candidateId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("candidates")
      .select("resume_url")
      .eq("id", data.candidateId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const raw = row?.resume_url;
    if (!raw) return { url: null as string | null };
    if (/^https?:\/\//i.test(raw)) return { url: raw };
    const { data: signed, error: sErr } = await supabase.storage
      .from("documents")
      .createSignedUrl(raw, 60 * 60);
    if (sErr) throw new Error(sErr.message);
    return { url: signed?.signedUrl ?? null };
  });

/**
 * Import a candidate from a CV that was already uploaded to the `documents` bucket.
 * Downloads the file, extracts text (PDF/DOCX/TXT), asks Lovable AI to structure it,
 * and inserts the candidate + a linked documents row. Duplicates on email/phone are skipped.
 */
export const extractCandidateFromCv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        storagePath: z.string().min(1).max(500),
        fileName: z.string().min(1).max(255),
        mime: z.string().max(200).nullable().optional(),
        sizeBytes: z.number().int().min(0).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // 1) Download the file from private storage. The `documents` bucket SELECT
    // policy only allows reads for paths already linked to a candidate/document/
    // client row — freshly uploaded CVs at candidates/{uid}/… have no such link
    // yet, so we use the admin client (caller is already authenticated).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: blob, error: dlErr } = await supabaseAdmin.storage
      .from("documents")
      .download(data.storagePath);
    if (dlErr || !blob) throw new Error(dlErr?.message ?? "Could not download uploaded CV");
    const bytes = new Uint8Array(await blob.arrayBuffer());

    // 2) Extract raw text.
    const { extractCvText } = await import("@/lib/cv-parse.server");
    let rawText = "";
    try {
      rawText = await extractCvText(bytes, data.fileName, data.mime ?? null);
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : "Could not read CV file");
    }

    const nameFromFile = data.fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Untitled candidate";
    type Extracted = {
      name?: string | null;
      email?: string | null;
      phone?: string | null;
      role?: string | null;
      current_company?: string | null;
      experience?: string | null;
      location?: string | null;
      linkedin_url?: string | null;
      salary?: string | null;
      salary_min?: number | null;
      salary_max?: number | null;
      skills?: string[] | null;
      notes?: string | null;
    };
    let extracted: Extracted = {};
    let partial = false;

    if (rawText.trim().length < 40) {
      partial = true;
    } else {
      // 3) Ask Lovable AI to structure the fields.
      const apiKey = process.env.LOVABLE_API_KEY;
      if (apiKey) {
        try {
          const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        signal: AbortSignal.timeout(45_000),
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "system",
                  content:
                    "You extract recruiter-facing candidate fields from a resume/CV. Return ONLY via the extract_candidate tool. Use null for missing fields. Keep values short. 'skills' should be 5-20 individual technologies or competencies. 'experience' like '6 years' or '3-5 years'. Salary min/max in LPA (lakhs per annum) as numbers when the CV states an Indian salary; leave null otherwise. 'notes' is a 1-2 sentence recruiter-facing summary.",
                },
                { role: "user", content: rawText.slice(0, 15_000) },
              ],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "extract_candidate",
                    description: "Return structured candidate fields.",
                    parameters: {
                      type: "object",
                      properties: {
                        name: { type: ["string", "null"] },
                        email: { type: ["string", "null"] },
                        phone: { type: ["string", "null"] },
                        role: { type: ["string", "null"] },
                        current_company: { type: ["string", "null"] },
                        experience: { type: ["string", "null"] },
                        location: { type: ["string", "null"] },
                        linkedin_url: { type: ["string", "null"] },
                        salary: { type: ["string", "null"] },
                        salary_min: { type: ["number", "null"] },
                        salary_max: { type: ["number", "null"] },
                        skills: { type: ["array", "null"], items: { type: "string" } },
                        notes: { type: ["string", "null"] },
                      },
                      required: [
                        "name","email","phone","role","current_company","experience","location",
                        "linkedin_url","salary","salary_min","salary_max","skills","notes",
                      ],
                      additionalProperties: false,
                    },
                  },
                },
              ],
              tool_choice: { type: "function", function: { name: "extract_candidate" } },
            }),
          });
          if (res.ok) {
            const json = (await res.json()) as {
              choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
            };
            const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
            if (args) {
              try { extracted = JSON.parse(args) as Extracted; } catch { /* ignore */ }
            }
          } else {
            partial = true;
          }
        } catch {
          partial = true;
        }
      } else {
        partial = true;
      }
    }

    // 4) Duplicate check on email/phone.
    const normEmail = extracted.email?.trim().toLowerCase() || null;
    const normPhone = extracted.phone?.replace(/\D+/g, "") || null;
    let duplicate: { id: string; name: string } | null = null;
    if (normEmail || (normPhone && normPhone.length >= 7)) {
      const orParts: string[] = [];
      if (normEmail) orParts.push(`email.ilike.${normEmail}`);
      if (normPhone && normPhone.length >= 7) orParts.push(`phone.ilike.%${normPhone.slice(-10)}%`);
      const { data: existing } = await supabase
        .from("candidates")
        .select("id,name,email,phone")
        .or(orParts.join(","))
        .limit(1);
      if (existing && existing.length > 0) {
        duplicate = {
          id: existing[0].id as string,
          name: (existing[0].name as string) ?? nameFromFile,
        };
      }
    }

    return {
      status: (duplicate ? "duplicate" : partial ? "partial" : "ready") as
        | "ready" | "partial" | "duplicate",
      duplicate,
      fallbackName: nameFromFile,
      fields: {
        name: extracted.name?.trim().slice(0, 200) || null,
        email: extracted.email?.trim().slice(0, 200) || null,
        phone: extracted.phone?.trim().slice(0, 50) || null,
        role: extracted.role?.trim().slice(0, 200) || null,
        current_company: extracted.current_company?.trim().slice(0, 200) || null,
        experience: extracted.experience?.trim().slice(0, 100) || null,
        location: extracted.location?.trim().slice(0, 200) || null,
        linkedin_url: extracted.linkedin_url?.trim().slice(0, 500) || null,
        salary: extracted.salary?.trim().slice(0, 200) || null,
        salary_min: typeof extracted.salary_min === "number" ? extracted.salary_min : null,
        salary_max: typeof extracted.salary_max === "number" ? extracted.salary_max : null,
        skills: Array.isArray(extracted.skills)
          ? extracted.skills.map((s) => String(s).trim()).filter(Boolean).slice(0, 40)
          : [],
        notes: extracted.notes?.trim().slice(0, 10_000) || null,
      },
    };
  });

/**
 * Save a candidate from a previewed/edited CV extraction.
 */
export const saveCandidateFromCv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        storagePath: z.string().min(1).max(500),
        fileName: z.string().min(1).max(255),
        mime: z.string().max(200).nullable().optional(),
        sizeBytes: z.number().int().min(0).nullable().optional(),
        sourceClientId: z.string().uuid().nullable().optional(),
        fields: candidateSchema.partial(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const f = data.fields;

    // Duplicate re-check.
    const normEmail = f.email?.trim().toLowerCase() || null;
    const normPhone = f.phone?.replace(/\D+/g, "") || null;
    if (normEmail || (normPhone && normPhone.length >= 7)) {
      const orParts: string[] = [];
      if (normEmail) orParts.push(`email.ilike.${normEmail}`);
      if (normPhone && normPhone.length >= 7) orParts.push(`phone.ilike.%${normPhone.slice(-10)}%`);
      const { data: existing } = await supabase
        .from("candidates")
        .select("id,name")
        .or(orParts.join(","))
        .limit(1);
      if (existing && existing.length > 0) {
        try { await supabase.storage.from("documents").remove([data.storagePath]); } catch { /* ignore */ }
        return {
          status: "duplicate" as const,
          candidateId: existing[0].id as string,
          name: (existing[0].name as string) ?? data.fileName,
        };
      }
    }

    const nameFromFile = data.fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Untitled candidate";
    const insertRow = clean({
      name: (f.name?.trim() || nameFromFile).slice(0, 200),
      email: f.email?.trim().slice(0, 200) || null,
      phone: f.phone?.trim().slice(0, 50) || null,
      role: f.role?.trim().slice(0, 200) || null,
      current_company: f.current_company?.trim().slice(0, 200) || null,
      experience: f.experience?.trim().slice(0, 100) || null,
      location: f.location?.trim().slice(0, 200) || null,
      linkedin_url: f.linkedin_url?.trim().slice(0, 500) || null,
      salary: f.salary?.trim().slice(0, 200) || null,
      salary_min: typeof f.salary_min === "number" ? f.salary_min : null,
      salary_max: typeof f.salary_max === "number" ? f.salary_max : null,
      skills: Array.isArray(f.skills)
        ? f.skills.map((s) => String(s).trim()).filter(Boolean).slice(0, 40)
        : [],
      notes: f.notes?.trim().slice(0, 10_000) || null,
      source: "database" as const,
      resume_url: data.storagePath,
      source_client_id: data.sourceClientId ?? null,
      created_by: userId,
    });

    const { data: row, error } = await supabase
      .from("candidates")
      .insert(insertRow as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    try {
      await supabase.from("documents").insert(
        clean({
          name: data.fileName,
          kind: "resume",
          candidate_id: row.id,
          storage_bucket: "documents",
          storage_path: data.storagePath,
          mime: data.mime ?? null,
          size_bytes: data.sizeBytes ?? null,
          uploaded_by: userId,
        }) as never,
      );
    } catch { /* non-fatal */ }

    await logActivity(supabase, userId, {
      kind: "submission",
      title: `Candidate imported from CV: ${row.name}`,
      detail: row.role ?? null,
      candidate_id: row.id,
    });

    return { status: "created" as const, candidate: row as CandidateRow };
  });

/**
 * Discard a CV upload without creating a candidate (cleans up storage).
 */
export const discardCvUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { storagePath: string }) =>
    z.object({ storagePath: z.string().min(1).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    try { await context.supabase.storage.from("documents").remove([data.storagePath]); } catch { /* ignore */ }
    return { ok: true };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Candidate Grid: structured-pool natural-language search + Gmail provenance
// ─────────────────────────────────────────────────────────────────────────────

export type PoolSearchResult = {
  candidate: CandidateRow;
  score: number;
  matched: string[];
  missing: string[];
  /** How strongly the candidate's actual occupation matched the query. */
  tier: string;
};

/**
 * Natural-language search over the *structured* candidate pool. No Gmail sweep:
 * candidates already in the database are answered from the database. The
 * occupation gate is identical to mailbox search, so "fashion designer" never
 * returns a Graphic/UX designer just because skills or city line up.
 */
export const searchCandidatePool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ query: z.string().min(2).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { planSearch } = await import("./search/query-plan.server");
    const { expandLocations } = await import("./search/query-plan.server");
    const { matchPoolCandidate } = await import("./search/pool-match");

    const { plan } = await planSearch(data.query);
    const { data: rows, error } = await context.supabase
      .from("candidates")
      .select("*, source_client:clients!candidates_source_client_id_fkey(id,name,color)")
      .limit(1000);
    if (error) throw new Error(error.message);

    const poolPlan = {
      roles: plan.roles,
      skills: plan.skills,
      keywords: plan.keywords,
      locations: expandLocations(plan.locations),
      minYears: plan.minYears,
      maxYears: plan.maxYears,
    };

    const results: PoolSearchResult[] = [];
    for (const row of (rows ?? []) as CandidateRow[]) {
      const m = matchPoolCandidate(poolPlan, row as never);
      if (!m.qualified || m.score <= 0) continue;
      results.push({ candidate: row, score: m.score, matched: m.matched, missing: m.missing, tier: m.tier });
    }
    results.sort((a, b) => b.score - a.score);
    return { plan, results: results.slice(0, 200) };
  });

export type CandidateSource = {
  kind: "email" | "attachment";
  fileName: string | null;
  subject: string | null;
  fromEmail: string | null;
  gmailThreadId: string | null;
  date: string | null;
  excerpt: string | null;
  /** Present for stored attachments so the UI can request a signed link. */
  storagePath: string | null;
};

/**
 * Provenance for a candidate discovered through the mailbox: the emails, threads
 * and stored resumes behind them. Read through the caller's own RLS client so a
 * candidate from another tenant/user can never leak.
 */
export const listCandidateSources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ candidateId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: candidate } = await context.supabase
      .from("candidates")
      .select("id")
      .eq("id", data.candidateId)
      .maybeSingle();
    if (!candidate) throw new Error("Candidate not found");

    const { data: people } = await context.supabase
      .from("email_candidates")
      .select("id")
      .eq("promoted_candidate_id", data.candidateId);
    const personIds = (people ?? []).map((p) => p.id as string);
    const sources: CandidateSource[] = [];
    if (!personIds.length) return { sources };

    const { data: versions } = await context.supabase
      .from("email_resume_versions")
      .select("file_name,storage_path,received_at,extracted_text,email_message_id")
      .in("email_candidate_id", personIds)
      .order("received_at", { ascending: false })
      .limit(20);

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
      const m = v.email_message_id ? msgs[v.email_message_id as string] : undefined;
      sources.push({
        kind: "attachment",
        fileName: (v.file_name as string | null) ?? "Resume",
        subject: m?.subject ?? null,
        fromEmail: m?.from_email ?? null,
        gmailThreadId: m?.gmail_thread_id ?? null,
        date: (v.received_at as string | null) ?? null,
        excerpt: ((v.extracted_text as string | null) ?? "").replace(/\s+/g, " ").trim().slice(0, 400) || null,
        storagePath: (v.storage_path as string | null) ?? null,
      });
    }

    const { data: mails } = await context.supabase
      .from("email_messages")
      .select("subject,from_email,gmail_thread_id,sent_at,snippet")
      .in("email_candidate_id", personIds)
      .order("sent_at", { ascending: false })
      .limit(20);
    for (const m of mails ?? []) {
      if (!m.gmail_thread_id) continue;
      sources.push({
        kind: "email",
        fileName: null,
        subject: (m.subject as string | null) ?? null,
        fromEmail: (m.from_email as string | null) ?? null,
        gmailThreadId: m.gmail_thread_id as string,
        date: (m.sent_at as string | null) ?? null,
        excerpt: (m.snippet as string | null) ?? null,
        storagePath: null,
      });
    }

    return { sources };
  });

/** Short-lived signed link for one stored file behind a candidate's provenance. */
export const getCandidateSourceUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ candidateId: z.string().uuid(), storagePath: z.string().min(1).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // The path must be reachable through the caller's own rows — never sign
    // an arbitrary storage path.
    const { data: people } = await context.supabase
      .from("email_candidates")
      .select("id")
      .eq("promoted_candidate_id", data.candidateId);
    const personIds = (people ?? []).map((p) => p.id as string);
    let allowed = false;
    if (personIds.length) {
      const { data: v } = await context.supabase
        .from("email_resume_versions")
        .select("id")
        .in("email_candidate_id", personIds)
        .eq("storage_path", data.storagePath)
        .limit(1);
      allowed = !!(v ?? []).length;
    }

    if (!allowed) {
      const { data: own } = await context.supabase
        .from("candidates")
        .select("id")
        .eq("id", data.candidateId)
        .eq("resume_url", data.storagePath)
        .maybeSingle();
      allowed = !!own;
    }
    if (!allowed) throw new Error("This file is not part of this candidate.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage.from("documents").createSignedUrl(data.storagePath, 300);
    if (error) throw new Error(error.message);
    return { url: signed!.signedUrl };
  });
