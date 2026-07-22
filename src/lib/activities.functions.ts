import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserAgencyId } from "@/lib/auth/agency";

export const ACTIVITY_KINDS = [
  "call",
  "shortlist",
  "share",
  "interview_scheduled",
  "interview_completed",
  "offer",
  "closure",
  "note",
  "submission",
  "document",
  "message",
  "stage_change",
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export type ActivityRow = {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string | null;
  client_id: string | null;
  position_id: string | null;
  candidate_id: string | null;
  application_id: string | null;
  actor_id: string | null;
  client_visible: boolean;
  occurred_at: string;
  created_at: string;
};

const activitySchema = z.object({
  kind: z.enum(ACTIVITY_KINDS),
  title: z.string().min(1).max(300),
  detail: z.string().max(2000).optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  position_id: z.string().uuid().optional().nullable(),
  candidate_id: z.string().uuid().optional().nullable(),
  application_id: z.string().uuid().optional().nullable(),
  client_visible: z.boolean().optional(),
});

function clean<T extends Record<string, any>>(o: T): T {
  const out: any = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === "" || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

export const listActivities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(500).optional(),
        actorId: z.string().uuid().optional(),
        clientId: z.string().uuid().optional(),
        positionId: z.string().uuid().optional(),
      })
      .optional()
      .parse(d) ?? {},
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("activities")
      .select("*")
      .order("occurred_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.actorId) q = q.eq("actor_id", data.actorId);
    if (data.clientId) q = q.eq("client_id", data.clientId);
    if (data.positionId) q = q.eq("position_id", data.positionId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as ActivityRow[];
  });

export const createActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => activitySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const agencyId = await getUserAgencyId(supabase, userId);
    if (!agencyId) throw new Error("You must belong to an agency to log activity.");
    const { data: row, error } = await supabase
      .from("activities")
      .insert(clean({ ...data, actor_id: userId, agency_id: agencyId }) as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as ActivityRow;
  });

export const deleteActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("activities").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const min = 60_000, hr = 60 * min, day = 24 * hr;
  if (diff < min) return "just now";
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  if (diff < 2 * day) return "Yesterday";
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(iso).toLocaleDateString();
}