import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DocumentRow = {
  id: string;
  name: string;
  kind: "jd" | "onboarding" | "offer" | "resume" | "other";
  client_id: string | null;
  position_id: string | null;
  candidate_id: string | null;
  application_id: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  mime: string | null;
  size_bytes: number | null;
  required: boolean;
  received: boolean;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  position?: { id: string; title: string } | null;
};

const upsertSchema = z.object({
  name: z.string().min(1).max(255),
  kind: z.enum(["jd", "onboarding", "offer", "resume", "other"]).default("other"),
  client_id: z.string().uuid().optional().nullable(),
  position_id: z.string().uuid().optional().nullable(),
  candidate_id: z.string().uuid().optional().nullable(),
  application_id: z.string().uuid().optional().nullable(),
  storage_bucket: z.string().max(80).optional().nullable(),
  storage_path: z.string().max(500).optional().nullable(),
  mime: z.string().max(200).optional().nullable(),
  size_bytes: z.number().int().min(0).optional().nullable(),
  required: z.boolean().optional(),
  received: z.boolean().optional(),
  notes: z.string().max(2000).optional().nullable(),
});

function clean<T extends Record<string, any>>(o: T): T {
  const out: any = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === "" || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

export const listDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        clientId: z.string().uuid().optional(),
        positionId: z.string().uuid().optional(),
        candidateId: z.string().uuid().optional(),
      })
      .optional()
      .parse(d) ?? {},
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("documents")
      .select("*, position:positions(id, title)")
      .order("created_at", { ascending: false });
    if (data?.clientId) q = q.eq("client_id", data.clientId);
    if (data?.positionId) q = q.eq("position_id", data.positionId);
    if (data?.candidateId) q = q.eq("candidate_id", data.candidateId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as DocumentRow[];
  });

export const listOwnClientDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: own } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!own?.id) return [] as DocumentRow[];
    const { data: rows, error } = await supabase
      .from("documents")
      .select("*, position:positions(id, title)")
      .eq("client_id", own.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as DocumentRow[];
  });

export const createDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("documents")
      .insert(clean({ ...data, uploaded_by: userId }) as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as unknown as DocumentRow;
  });

export const updateDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid() }).merge(upsertSchema.partial()).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, ...rest } = data;
    const { data: row, error } = await supabase
      .from("documents")
      .update(clean(rest))
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as unknown as DocumentRow;
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: existing } = await supabase
      .from("documents")
      .select("storage_bucket, storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (existing?.storage_bucket && existing?.storage_path) {
      await supabase.storage.from(existing.storage_bucket).remove([existing.storage_path]);
    }
    const { error } = await supabase.from("documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });