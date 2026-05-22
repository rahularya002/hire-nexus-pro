import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const APPLICATION_STAGES = [
  "sourcing",
  "recruiter_shortlist",
  "shared_with_client",
  "client_shortlist",
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
  interview_scheduled: "Interview Scheduled",
  rounds: "Rounds",
  offered: "Offered",
  closed: "Closed",
};

export const CLIENT_VISIBLE_STAGES: ApplicationStage[] = [
  "shared_with_client",
  "client_shortlist",
  "interview_scheduled",
  "rounds",
  "offered",
  "closed",
];

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
  source: "manual" | "scout" | "referral" | "database" | "inbound";
  notes: string | null;
  created_at: string;
  updated_at: string;
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

const candidateSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(200).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  role: z.string().max(200).optional().nullable(),
  experience: z.string().max(100).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  current_company: z.string().max(200).optional().nullable(),
  skills: z.array(z.string().min(1).max(60)).max(40).optional(),
  resume_url: z.string().url().max(500).optional().nullable(),
  source: z.enum(["manual", "scout", "referral", "database", "inbound"]).optional(),
  notes: z.string().max(10_000).optional().nullable(),
});

function clean<T extends Record<string, any>>(o: T): T {
  const out: any = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === "" || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

export const listCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("candidates")
      .select("*")
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
    const { data: row, error } = await supabase
      .from("candidates")
      .insert(clean({ ...data, created_by: userId }))
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as CandidateRow;
  });

export const updateCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid() }).merge(candidateSchema.partial()).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, ...rest } = data;
    const { data: row, error } = await supabase
      .from("candidates")
      .update(clean(rest))
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as CandidateRow;
  });

export const deleteCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("candidates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
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
      .insert(clean({ ...data, created_by: userId }))
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as ApplicationRow;
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
    const { supabase } = context;
    const { id, ...rest } = data;
    const { data: row, error } = await supabase
      .from("applications")
      .update(clean(rest))
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as ApplicationRow;
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

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}