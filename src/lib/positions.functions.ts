import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
  assigned_recruiter_id: string | null;
  client_assignee_id: string | null;
  recruitment_model: "agency" | "self" | "hybrid";
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
  assigned_recruiter_id: z.string().uuid().nullable().optional(),
  client_assignee_id: z.string().uuid().nullable().optional(),
  recruitment_model: z.enum(["agency", "self", "hybrid"]).optional(),
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
    z.object({
      clientId: z.string().uuid().optional(),
      recruitmentModel: z.enum(["agency", "self", "hybrid"]).optional(),
    }).optional().parse(d) ?? {},
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Recruiters only see positions assigned to them.
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roleNames = (roles ?? []).map((r) => r.role as string);
    const isPrivileged =
      roleNames.includes("super_admin") ||
      roleNames.includes("admin") ||
      roleNames.includes("lead_recruiter") ||
      roleNames.includes("senior_recruiter");
    const isRecruiterOnly = roleNames.includes("recruiter") && !isPrivileged && !roleNames.includes("client");

    let q = supabase
      .from("positions")
      .select("*, client:clients(id, name, color, industry, contact_name)")
      .order("posted_at", { ascending: false });
    if (data?.clientId) q = q.eq("client_id", data.clientId);
    if (data?.recruitmentModel) q = q.eq("recruitment_model", data.recruitmentModel);
    if (isRecruiterOnly) q = q.eq("assigned_recruiter_id", userId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as PositionRow[];
  });

export const getPositionById = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Guard against legacy/mock non-uuid ids slipping through stale links.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.id)) {
      return null;
    }
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
      .insert(clean({ ...data, created_by: userId }) as never)
      .select("*, client:clients(name)")
      .single();
    if (error) throw new Error(error.message);

    // Notify agency staff about the new requirement. Never let a notification
    // failure block the create itself.
    try {
      const model = (row as any).recruitment_model as string | null;
      const agencyId = (row as any).agency_id as string | null;
      const title = (row as any).title as string;
      const clientName = ((row as any).client?.name ?? null) as string | null;
      const assignedId = ((row as any).assigned_recruiter_id ?? null) as string | null;

      if (model !== "self" && agencyId) {
        const { data: members } = await supabaseAdmin
          .from("agency_members")
          .select("user_id")
          .eq("agency_id", agencyId);
        const memberIds = (members ?? [])
          .map((m) => m.user_id)
          .filter((id) => id !== userId);
        if (memberIds.length) {
          const link = `/positions/${(row as any).id}`;
          const body = clientName
            ? `${clientName} posted a new requirement`
            : "A client posted a new requirement";
          await supabaseAdmin.from("notifications").insert(
            memberIds.map((uid) => ({
              user_id: uid,
              kind: "system" as const,
              title: `New requirement: ${title}`,
              body: uid === assignedId ? `${body} — assigned to you` : body,
              link,
            })),
          );
        }

        if (assignedId && assignedId !== userId) {
          await supabaseAdmin.from("notifications").insert({
            user_id: assignedId,
            kind: "system" as const,
            title: `Assigned: ${title}`,
            body: clientName
              ? `New requirement from ${clientName}`
              : "You've been assigned a new requirement.",
            link: `/positions/${(row as any).id}`,
          });
        }
      }
    } catch (notifyErr) {
      console.error("[createPosition] notification insert failed", notifyErr);
    }

    return row as unknown as PositionRow;
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

export const assignPositionRecruiter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      assigned_recruiter_id: z.string().uuid().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: prev } = await supabase
      .from("positions")
      .select("assigned_recruiter_id, title, client:clients(name)")
      .eq("id", data.id)
      .maybeSingle();
    const { data: row, error } = await supabase
      .from("positions")
      .update({ assigned_recruiter_id: data.assigned_recruiter_id })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    if (
      data.assigned_recruiter_id &&
      data.assigned_recruiter_id !== prev?.assigned_recruiter_id
    ) {
      const clientName = (prev as any)?.client?.name as string | undefined;
      const title = prev?.title ?? "a requirement";
      await supabaseAdmin.from("notifications").insert({
        user_id: data.assigned_recruiter_id,
        kind: "system",
        title: `Assigned: ${title}`,
        body: clientName ? `New requirement from ${clientName}` : "You've been assigned a new requirement.",
        link: `/positions/${data.id}`,
      });
    }
    return row as PositionRow;
  });

export const listAssignableRecruiters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Scope to the caller's agency so recruiters from other agencies never leak.
    const { data: callerMembership } = await supabaseAdmin
      .from("agency_members")
      .select("agency_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!callerMembership?.agency_id) return [] as { id: string; name: string; role: string }[];

    const { data: agencyMembers, error: amErr } = await supabaseAdmin
      .from("agency_members")
      .select("user_id")
      .eq("agency_id", callerMembership.agency_id);
    if (amErr) throw new Error(amErr.message);
    const memberIds = (agencyMembers ?? []).map((m) => m.user_id);
    if (memberIds.length === 0) return [] as { id: string; name: string; role: string }[];

    const { data: roles, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["recruiter", "senior_recruiter", "lead_recruiter"])
      .in("user_id", memberIds);
    if (rErr) throw new Error(rErr.message);
    const ids = (roles ?? []).map((r) => r.user_id);
    if (ids.length === 0) return [] as { id: string; name: string; role: string }[];
    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ids);
    if (pErr) throw new Error(pErr.message);
    const roleMap = new Map(roles!.map((r) => [r.user_id, r.role as string]));
    return (profiles ?? []).map((p) => ({
      id: p.id,
      name: p.full_name ?? p.email ?? "Unknown",
      role: roleMap.get(p.id) ?? "recruiter",
    }));
  });

export const assignClientRecruiter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      clientId: z.string().uuid(),
      assigned_recruiter_id: z.string().uuid().nullable(),
      onlyOpen: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("positions")
      .update({ assigned_recruiter_id: data.assigned_recruiter_id })
      .eq("client_id", data.clientId);
    if (data.onlyOpen) q = q.neq("status", "closed");
    const { data: rows, error } = await q.select("id, title, assigned_recruiter_id");
    if (error) throw new Error(error.message);
    if (data.assigned_recruiter_id && rows && rows.length) {
      const { data: client } = await supabase
        .from("clients").select("name").eq("id", data.clientId).maybeSingle();
      await supabaseAdmin.from("notifications").insert({
        user_id: data.assigned_recruiter_id,
        kind: "system",
        title: `Assigned to ${client?.name ?? "a client"}`,
        body: `You've been assigned ${rows.length} requirement${rows.length > 1 ? "s" : ""}.`,
        link: `/clients/${data.clientId}`,
      });
    }
    return { count: rows?.length ?? 0 };
  });