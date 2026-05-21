import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PositionRow = {
  id: string;
  client_id: string;
  title: string;
  location: string | null;
  experience: string | null;
  salary: string | null;
  openings: number;
  priority: "high" | "medium" | "low";
  status: "open" | "in_progress" | "interviews" | "closed";
  description: string | null;
  skills: string[];
  posted_at: string;
  created_at: string;
  client?: { id: string; name: string; color: string | null; industry: string | null; contact_name: string | null } | null;
};

const upsertSchema = z.object({
  client_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  location: z.string().max(200).optional().nullable(),
  experience: z.string().max(100).optional().nullable(),
  salary: z.string().max(100).optional().nullable(),
  openings: z.number().int().min(1).max(999).optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  status: z.enum(["open", "in_progress", "interviews", "closed"]).optional(),
  description: z.string().max(10_000).optional().nullable(),
  skills: z.array(z.string().min(1).max(60)).max(30).optional(),
});

function clean<T extends Record<string, any>>(o: T): T {
  const out: any = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === "" || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

export const listPositions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ clientId: z.string().uuid().optional() }).optional().parse(d) ?? {},
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("positions")
      .select("*, client:clients(id, name, color, industry, contact_name)")
      .order("posted_at", { ascending: false });
    if (data?.clientId) q = q.eq("client_id", data.clientId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as PositionRow[];
  });

export const getPositionById = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("positions")
      .select("*, client:clients(id, name, color, industry, contact_name)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row as PositionRow | null;
  });

export const createPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("positions")
      .insert(clean({ ...data, created_by: userId }))
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as PositionRow;
  });

export const updatePosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid() }).merge(upsertSchema.partial()).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, ...rest } = data;
    const { data: row, error } = await supabase
      .from("positions")
      .update(clean(rest))
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as PositionRow;
  });

export const deletePosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("positions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });