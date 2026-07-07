import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: super admin only.");
}

export type AgencyRow = {
  id: string;
  name: string;
  slug: string;
  owner_user_id: string | null;
  owner_email: string | null;
  status: "trial" | "active" | "suspended" | "rejected" | "pending";
  plan: "starter" | "professional" | "enterprise";
  trial_ends_at: string | null;
  mrr_cents: number;
  notes: string | null;
  created_at: string;
  member_count: number;
};

export const listAgencies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ agencies: AgencyRow[] }> => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data: agencies, error } = await supabaseAdmin
      .from("agencies")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ownerIds = (agencies ?? [])
      .map((a) => a.owner_user_id)
      .filter((x): x is string => !!x);
    const { data: owners } = ownerIds.length
      ? await supabaseAdmin.from("profiles").select("id, email").in("id", ownerIds)
      : { data: [] as { id: string; email: string | null }[] };
    const ownerMap = new Map((owners ?? []).map((o) => [o.id, o.email]));

    const { data: members } = await supabaseAdmin
      .from("agency_members")
      .select("agency_id");
    const counts = new Map<string, number>();
    (members ?? []).forEach((m) =>
      counts.set(m.agency_id, (counts.get(m.agency_id) ?? 0) + 1),
    );

    return {
      agencies: (agencies ?? []).map((a) => ({
        ...a,
        owner_email: a.owner_user_id ? ownerMap.get(a.owner_user_id) ?? null : null,
        member_count: counts.get(a.id) ?? 0,
      })) as AgencyRow[],
    };
  });

export const getAgency = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data: agency, error } = await supabaseAdmin
      .from("agencies")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!agency) throw new Error("Agency not found.");

    const { data: members } = await supabaseAdmin
      .from("agency_members")
      .select("user_id, role_in_agency, created_at")
      .eq("agency_id", data.id);
    const userIds = (members ?? []).map((m) => m.user_id);
    const { data: profs } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", userIds)
      : { data: [] };
    const profMap = new Map((profs ?? []).map((p) => [p.id, p]));

    const enrichedMembers = (members ?? []).map((m) => ({
      user_id: m.user_id,
      role_in_agency: m.role_in_agency,
      created_at: m.created_at,
      full_name: profMap.get(m.user_id)?.full_name ?? null,
      email: profMap.get(m.user_id)?.email ?? null,
    }));

    let owner_email: string | null = null;
    if (agency.owner_user_id) {
      const { data: o } = await supabaseAdmin
        .from("profiles").select("email").eq("id", agency.owner_user_id).maybeSingle();
      owner_email = o?.email ?? null;
    }

    return { agency: { ...agency, owner_email }, members: enrichedMembers };
  });

const CreateAgencySchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  ownerEmail: z.string().email().max(255),
  ownerPassword: z.string().min(8).max(128),
  ownerName: z.string().min(1).max(255),
  plan: z.enum(["starter", "professional", "enterprise"]),
  trialDays: z.number().int().min(0).max(180).default(14),
  mrrCents: z.number().int().min(0).max(10_000_000).default(0),
});

export const createAgency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateAgencySchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);

    let ownerId: string;
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.ownerEmail,
      password: data.ownerPassword,
      email_confirm: true,
      user_metadata: { full_name: data.ownerName },
    });
    if (created?.user) {
      ownerId = created.user.id;
    } else {
      const msg = createErr?.message ?? "";
      const alreadyExists = /already been registered|already exists|duplicate/i.test(msg);
      if (!alreadyExists) throw new Error(msg || "Could not create owner.");
      // Reuse existing auth user by email
      const { data: existing, error: findErr } = await supabaseAdmin
        .from("profiles").select("id").eq("email", data.ownerEmail).maybeSingle();
      if (findErr || !existing?.id) {
        throw new Error("An account with this email already exists. Use a different email.");
      }
      ownerId = existing.id;
      // Reset password so the provided credentials work
      await supabaseAdmin.auth.admin.updateUserById(ownerId, {
        password: data.ownerPassword,
        email_confirm: true,
        user_metadata: { full_name: data.ownerName },
      });
    }

    await supabaseAdmin.from("profiles")
      .update({ full_name: data.ownerName, status: "active" })
      .eq("id", ownerId);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", ownerId);
    await supabaseAdmin.from("user_roles").insert({ user_id: ownerId, role: "admin" });

    const trialEnds = data.trialDays > 0
      ? new Date(Date.now() + data.trialDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { data: agency, error: aErr } = await supabaseAdmin.from("agencies").insert({
      name: data.name,
      slug: data.slug,
      owner_user_id: ownerId,
      status: data.trialDays > 0 ? "trial" : "active",
      plan: data.plan,
      trial_ends_at: trialEnds,
      mrr_cents: data.mrrCents,
    }).select().single();
    if (aErr) throw new Error(aErr.message);

    await supabaseAdmin.from("agency_members").insert({
      agency_id: agency.id,
      user_id: ownerId,
      role_in_agency: "admin",
    });

    return { ok: true, agencyId: agency.id };
  });

const UpdateStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["trial", "active", "suspended", "rejected", "pending"]),
});
export const updateAgencyStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UpdateStatusSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { error } = await supabaseAdmin.from("agencies").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const UpdatePlanSchema = z.object({
  id: z.string().uuid(),
  plan: z.enum(["starter", "professional", "enterprise"]),
  mrrCents: z.number().int().min(0).max(10_000_000).optional(),
});
export const updateAgencyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UpdatePlanSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const patch: { plan: "starter" | "professional" | "enterprise"; mrr_cents?: number } = { plan: data.plan };
    if (typeof data.mrrCents === "number") patch.mrr_cents = data.mrrCents;
    const { error } = await supabaseAdmin.from("agencies").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ExtendTrialSchema = z.object({
  id: z.string().uuid(),
  days: z.number().int().min(1).max(180),
});
export const extendTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ExtendTrialSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data: a } = await supabaseAdmin.from("agencies").select("trial_ends_at").eq("id", data.id).maybeSingle();
    const base = a?.trial_ends_at ? new Date(a.trial_ends_at).getTime() : Date.now();
    const next = new Date(Math.max(base, Date.now()) + data.days * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabaseAdmin
      .from("agencies")
      .update({ trial_ends_at: next, status: "trial" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, trial_ends_at: next };
  });

export const deleteAgency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { error } = await supabaseAdmin.from("agencies").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getRevenueStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data: agencies } = await supabaseAdmin
      .from("agencies").select("status, plan, mrr_cents, trial_ends_at");
    const list = agencies ?? [];
    const active = list.filter((a) => a.status === "active");
    const trials = list.filter((a) => a.status === "trial");
    const mrr = active.reduce((s, a) => s + (a.mrr_cents ?? 0), 0);
    const byPlan: Record<string, number> = { starter: 0, professional: 0, enterprise: 0 };
    active.forEach((a) => { byPlan[a.plan] = (byPlan[a.plan] ?? 0) + 1; });
    const now = Date.now();
    const trialsExpiringSoon = trials.filter((a) => {
      if (!a.trial_ends_at) return false;
      const t = new Date(a.trial_ends_at).getTime();
      return t - now < 7 * 24 * 60 * 60 * 1000;
    }).length;
    return {
      mrr_cents: mrr,
      arr_cents: mrr * 12,
      activeCount: active.length,
      trialCount: trials.length,
      suspendedCount: list.filter((a) => a.status === "suspended").length,
      totalAgencies: list.length,
      byPlan,
      trialsExpiringSoon,
    };
  });

export const getUsageStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const [agencies, roles, clients, positions, placements] = await Promise.all([
      supabaseAdmin.from("agencies").select("id, name, plan, status"),
      supabaseAdmin.from("user_roles").select("role"),
      supabaseAdmin.from("clients").select("id"),
      supabaseAdmin.from("positions").select("id, status"),
      supabaseAdmin.from("placements").select("id"),
    ]);

    const roleRows = roles.data ?? [];
    const recruiterCount = roleRows.filter((r) =>
      ["recruiter", "senior_recruiter", "lead_recruiter"].includes(r.role as string)
    ).length;

    return {
      agencies: agencies.data ?? [],
      totals: {
        recruiters: recruiterCount,
        clients: clients.data?.length ?? 0,
        activeJobs: (positions.data ?? []).filter((p) => p.status === "open").length,
        placements: placements.data?.length ?? 0,
      },
    };
  });

export const listTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data, error } = await supabaseAdmin
      .from("support_tickets")
      .select("*, agencies(name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { tickets: data ?? [] };
  });

const UpdateTicketSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
  priority: z.string().min(1).max(32).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
});
export const updateTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UpdateTicketSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const patch: {
      status?: "open" | "in_progress" | "resolved" | "closed";
      priority?: string;
      assigned_to?: string | null;
    } = {};
    if (data.status) patch.status = data.status;
    if (data.priority) patch.priority = data.priority;
    if (data.assigned_to !== undefined) patch.assigned_to = data.assigned_to;
    const { error } = await supabaseAdmin.from("support_tickets").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const CreateTicketSchema = z.object({
  agency_id: z.string().uuid().nullable(),
  type: z.enum(["support", "billing", "feature_request"]),
  subject: z.string().min(1).max(255),
  body: z.string().max(5000).optional(),
  priority: z.string().max(32).default("normal"),
});
export const createTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateTicketSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { error } = await supabaseAdmin.from("support_tickets").insert({
      agency_id: data.agency_id,
      type: data.type,
      subject: data.subject,
      body: data.body ?? null,
      priority: data.priority,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });