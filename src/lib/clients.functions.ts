import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ClientRow = {
  id: string;
  name: string;
  industry: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: "active" | "inactive";
  notes: string | null;
  color: string | null;
  last_activity_at: string | null;
  created_at: string;
  user_id?: string | null;
  open_positions?: number;
  closed_positions?: number;
  last_invoice_at?: string | null;
  last_invoice_amount?: number | null;
  pan_number?: string | null;
  gst_number?: string | null;
  registered_address?: string | null;
  website?: string | null;
};

const upsertSchema = z.object({
  name: z.string().min(1).max(200),
  industry: z.string().max(200).optional().nullable(),
  contact_name: z.string().max(200).optional().nullable(),
  contact_email: z.string().email().max(200).optional().nullable().or(z.literal("")),
  contact_phone: z.string().max(50).optional().nullable(),
  status: z.enum(["active", "inactive"]).optional(),
  notes: z.string().max(5000).optional().nullable(),
  color: z.string().max(80).optional().nullable(),
  pan_number: z.string().max(50).optional().nullable(),
  gst_number: z.string().max(50).optional().nullable(),
  registered_address: z.string().max(500).optional().nullable(),
  website: z.string().max(300).optional().nullable(),
});

function clean<T extends Record<string, any>>(o: T): T {
  const out: any = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === "" || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Recruiters only see clients that have a position assigned to them.
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roleNames = (roles ?? []).map((r) => r.role as string);
    const isPrivileged =
      roleNames.includes("admin") ||
      roleNames.includes("lead_recruiter") ||
      roleNames.includes("senior_recruiter");

    let allowedClientIds: string[] | null = null;
    if (!isPrivileged) {
      const { data: assigned, error: aErr } = await supabase
        .from("positions")
        .select("client_id")
        .eq("assigned_recruiter_id", userId);
      if (aErr) throw new Error(aErr.message);
      allowedClientIds = Array.from(
        new Set((assigned ?? []).map((p) => p.client_id).filter(Boolean) as string[]),
      );
      if (allowedClientIds.length === 0) return [] as ClientRow[];
    }

    let clientsQ = supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });
    if (allowedClientIds) clientsQ = clientsQ.in("id", allowedClientIds);
    const { data: clients, error } = await clientsQ;
    if (error) throw new Error(error.message);
    const { data: positions } = await supabase
      .from("positions")
      .select("client_id, status");
    const openCounts = new Map<string, number>();
    const closedCounts = new Map<string, number>();
    for (const p of positions ?? []) {
      if (p.status === "closed") {
        closedCounts.set(p.client_id, (closedCounts.get(p.client_id) ?? 0) + 1);
      } else {
        openCounts.set(p.client_id, (openCounts.get(p.client_id) ?? 0) + 1);
      }
    }
    const { data: invoices } = await supabase
      .from("invoices")
      .select("client_id, total_inr, issue_date, created_at")
      .order("issue_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    const lastInvoice = new Map<string, { at: string | null; amount: number | null }>();
    for (const inv of invoices ?? []) {
      if (!inv.client_id || lastInvoice.has(inv.client_id)) continue;
      lastInvoice.set(inv.client_id, {
        at: (inv.issue_date as string | null) ?? (inv.created_at as string | null),
        amount: inv.total_inr === null || inv.total_inr === undefined ? null : Number(inv.total_inr),
      });
    }
    return (clients ?? []).map((c) => ({
      ...c,
      open_positions: openCounts.get(c.id) ?? 0,
      closed_positions: closedCounts.get(c.id) ?? 0,
      last_invoice_at: lastInvoice.get(c.id)?.at ?? null,
      last_invoice_amount: lastInvoice.get(c.id)?.amount ?? null,
    })) as ClientRow[];
  });

export type ScoutClientOption = { id: string; name: string; color: string | null };

export const listScoutClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roleNames = (roles ?? []).map((r) => r.role as string);
    const isPrivileged =
      roleNames.includes("admin") ||
      roleNames.includes("lead_recruiter") ||
      roleNames.includes("senior_recruiter");

    if (isPrivileged) {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, color")
        .order("name", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as ScoutClientOption[];
    }

    // Recruiter: only clients with positions assigned to them
    const { data: positions, error: posErr } = await supabase
      .from("positions")
      .select("client_id")
      .eq("assigned_recruiter_id", userId);
    if (posErr) throw new Error(posErr.message);
    const clientIds = Array.from(new Set((positions ?? []).map((p) => p.client_id).filter(Boolean)));
    if (clientIds.length === 0) return [] as ScoutClientOption[];
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, color")
      .in("id", clientIds)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as ScoutClientOption[];
  });

export const getClientById = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: client, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return client as ClientRow | null;
  });

export const createClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = clean({ ...data, created_by: userId, last_activity_at: new Date().toISOString() });
    const { data: row, error } = await supabase
      .from("clients")
      .insert(payload as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as ClientRow;
  });

export const updateClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid() }).merge(upsertSchema.partial()).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, ...rest } = data;
    const { data: row, error } = await supabase
      .from("clients")
      .update(clean(rest))
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as ClientRow;
  });

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // verify caller is admin/lead
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roleNames = (roles ?? []).map((r) => r.role as string);
    if (!isAdminLike(roleNames)) {
      throw new Error("Only admins or lead recruiters can delete clients.");
    }

    // Look up linked auth user before deleting the row
    const { data: clientRow } = await supabaseAdmin
      .from("clients")
      .select("user_id")
      .eq("id", data.id)
      .maybeSingle();

    // Delete dependent positions first (no FK cascade defined)
    const { error: posErr } = await supabaseAdmin
      .from("positions")
      .delete()
      .eq("client_id", data.id);
    if (posErr) throw new Error(posErr.message);

    const { error } = await supabaseAdmin.from("clients").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    // Best-effort: remove the linked auth account so the login is revoked
    if (clientRow?.user_id) {
      try {
        await supabaseAdmin.from("user_roles").delete().eq("user_id", clientRow.user_id);
        await supabaseAdmin.from("profiles").delete().eq("id", clientRow.user_id);
        await supabaseAdmin.auth.admin.deleteUser(clientRow.user_id);
      } catch (e) {
        console.error("Failed to fully delete client auth user", e);
      }
    }
    return { ok: true };
  });

const onboardSchema = upsertSchema.extend({
  login_email: z.string().email().max(200),
  login_password: z.string().min(8).max(72),
  full_name: z.string().max(200).optional().nullable(),
});

function isAdminLike(roles: string[]) {
  return roles.includes("admin") || roles.includes("lead_recruiter");
}

export const onboardClientWithLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => onboardSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // verify caller is admin/lead
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roleNames = (roles ?? []).map((r) => r.role as string);
    if (!isAdminLike(roleNames)) {
      throw new Error("Only admins or lead recruiters can onboard clients.");
    }

    // 1. Create auth user
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.login_email,
      password: data.login_password,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name ?? data.contact_name ?? data.name,
        company_name: data.name,
      },
    });
    if (createErr || !created.user) {
      throw new Error(createErr?.message ?? "Failed to create login account.");
    }
    const newUserId = created.user.id;

    try {
      // 2. Ensure 'client' role (handle_new_user trigger already inserts it for non-first users)
      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: newUserId, role: "client" },
          { onConflict: "user_id,role", ignoreDuplicates: true },
        );
      if (roleErr) throw new Error(roleErr.message);

      // 2b. Activate profile (trigger defaults non-first users to 'pending')
      const { error: profileErr } = await supabaseAdmin
        .from("profiles")
        .update({ status: "active", company_name: data.name })
        .eq("id", newUserId);
      if (profileErr) throw new Error(profileErr.message);

      // 3. Resolve caller's agency (clients belong to the agency that created them)
      const { data: agencyMembership } = await supabaseAdmin
        .from("agency_members")
        .select("agency_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (!agencyMembership?.agency_id) {
        throw new Error("You are not a member of any agency; cannot create a client.");
      }

      // 4. Insert client row (service-role insert requires explicit agency_id)
      const payload = clean({
        name: data.name,
        industry: data.industry,
        contact_name: data.contact_name ?? data.full_name,
        contact_email: data.contact_email ?? data.login_email,
        contact_phone: data.contact_phone,
        notes: data.notes,
        color: data.color,
        pan_number: data.pan_number,
        gst_number: data.gst_number,
        registered_address: data.registered_address,
        website: data.website,
        created_by: userId,
        user_id: newUserId,
        agency_id: agencyMembership.agency_id,
        last_activity_at: new Date().toISOString(),
      });
      const { data: row, error: insertErr } = await supabaseAdmin
        .from("clients")
        .insert(payload as never)
        .select("*")
        .single();
      if (insertErr) throw new Error(insertErr.message);

      return {
        client: row as ClientRow,
        login: { email: data.login_email, password: data.login_password },
      };
    } catch (err) {
      // best-effort rollback
      await supabaseAdmin.auth.admin.deleteUser(newUserId).catch(() => {});
      throw err;
    }
  });