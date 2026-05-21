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
    const { supabase } = context;
    const { data: clients, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: positions } = await supabase
      .from("positions")
      .select("client_id, status");
    const openCounts = new Map<string, number>();
    for (const p of positions ?? []) {
      if (p.status !== "closed") {
        openCounts.set(p.client_id, (openCounts.get(p.client_id) ?? 0) + 1);
      }
    }
    return (clients ?? []).map((c) => ({
      ...c,
      open_positions: openCounts.get(c.id) ?? 0,
    })) as ClientRow[];
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
      .insert(payload)
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
    const { supabase } = context;
    const { error } = await supabase.from("clients").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
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
      // 2. Assign 'client' role
      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: newUserId, role: "client" });
      if (roleErr) throw new Error(roleErr.message);

      // 3. Insert client row
      const payload = clean({
        name: data.name,
        industry: data.industry,
        contact_name: data.contact_name ?? data.full_name,
        contact_email: data.contact_email ?? data.login_email,
        contact_phone: data.contact_phone,
        notes: data.notes,
        color: data.color,
        created_by: userId,
        user_id: newUserId,
        last_activity_at: new Date().toISOString(),
      });
      const { data: row, error: insertErr } = await supabaseAdmin
        .from("clients")
        .insert(payload)
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