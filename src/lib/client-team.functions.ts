import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ClientMemberRole = "client_admin" | "client_recruiter" | "client_viewer";

export type ClientMember = {
  id: string;
  user_id: string | null;
  invited_email: string | null;
  full_name: string | null;
  role: ClientMemberRole | null;
  custom_role_id: string | null;
  custom_role_name: string | null;
  status: string;
  created_at: string;
};

export type ClientCustomRole = {
  id: string;
  name: string;
  permissions: string[];
};

export type MyClientContext = {
  clientId: string | null;
  companyName: string | null;
  isOwner: boolean;
  isTeamMember: boolean;
};

export const getMyClientContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyClientContext> => {
    const { data: owned } = await context.supabase
      .from("clients")
      .select("id, name")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (owned) {
      return {
        clientId: owned.id,
        companyName: owned.name ?? null,
        isOwner: true,
        isTeamMember: false,
      };
    }
    const { data: member } = await context.supabase
      .from("client_members")
      .select("client_id, clients:clients(id, name)")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .maybeSingle();
    if (member && (member as any).clients) {
      const c = (member as any).clients;
      return {
        clientId: c.id,
        companyName: c.name ?? null,
        isOwner: false,
        isTeamMember: true,
      };
    }
    return { clientId: null, companyName: null, isOwner: false, isTeamMember: false };
  });

export const CLIENT_PERMISSIONS = [
  "positions.view",
  "positions.create",
  "positions.edit",
  "candidates.view",
  "candidates.submit",
  "candidates.shortlist",
  "interviews.schedule",
  "interviews.feedback",
  "messages.send",
  "documents.upload",
] as const;

const DEFAULT_PERMS: Record<ClientMemberRole, string[]> = {
  client_admin: [...CLIENT_PERMISSIONS, "team.manage"],
  client_recruiter: [
    "positions.view",
    "candidates.view",
    "candidates.submit",
    "candidates.shortlist",
    "interviews.schedule",
    "interviews.feedback",
    "messages.send",
    "documents.upload",
  ],
  client_viewer: ["positions.view", "candidates.view"],
};

async function getOwnedClientId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("clients")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

export const listClientMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ clientId: string | null; members: ClientMember[] }> => {
    const clientId = await getOwnedClientId(context.supabase, context.userId);
    if (!clientId) return { clientId: null, members: [] };
    const { data, error } = await context.supabase
      .from("client_members")
      .select("id, user_id, invited_email, full_name, role, custom_role_id, status, created_at, custom:client_custom_roles(name)")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const members: ClientMember[] = (data ?? []).map((r: any) => ({
      id: r.id,
      user_id: r.user_id,
      invited_email: r.invited_email,
      full_name: r.full_name,
      role: r.role ?? null,
      custom_role_id: r.custom_role_id ?? null,
      custom_role_name: r.custom?.name ?? null,
      status: r.status,
      created_at: r.created_at,
    }));
    return { clientId, members };
  });

const InviteSchema = z.object({
  email: z.string().email().max(255),
  fullName: z.string().min(1).max(255),
  password: z.string().min(8).max(128),
  role: z.enum(["client_admin", "client_recruiter", "client_viewer"]).nullable().optional(),
  customRoleId: z.string().uuid().nullable().optional(),
}).refine((d) => Boolean(d.role) !== Boolean(d.customRoleId), {
  message: "Provide exactly one of role or customRoleId",
});

export const inviteClientMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InviteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const clientId = await getOwnedClientId(context.supabase, context.userId);
    if (!clientId) throw new Error("Only the client admin can invite team members.");

    if (data.customRoleId) {
      const { data: cr } = await context.supabase
        .from("client_custom_roles")
        .select("id")
        .eq("id", data.customRoleId)
        .eq("client_id", clientId)
        .maybeSingle();
      if (!cr) throw new Error("Unknown custom role.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (createErr || !created?.user) throw new Error(createErr?.message ?? "Could not create account.");
    const newUserId = created.user.id;

    await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.fullName, status: "active" })
      .eq("id", newUserId);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    await supabaseAdmin.from("user_roles").insert({ user_id: newUserId, role: "client" });

    const { error: insErr } = await supabaseAdmin.from("client_members").insert({
      client_id: clientId,
      user_id: newUserId,
      invited_email: data.email,
      full_name: data.fullName,
      role: data.customRoleId ? null : data.role ?? null,
      custom_role_id: data.customRoleId ?? null,
      status: "active",
      created_by: context.userId,
    });
    if (insErr) throw new Error(insErr.message);

    return { ok: true, userId: newUserId };
  });

const UpdateRoleSchema = z.object({
  memberId: z.string().uuid(),
  role: z.enum(["client_admin", "client_recruiter", "client_viewer"]).nullable().optional(),
  customRoleId: z.string().uuid().nullable().optional(),
}).refine((d) => Boolean(d.role) !== Boolean(d.customRoleId), {
  message: "Provide exactly one of role or customRoleId",
});

export const updateClientMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateRoleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const clientId = await getOwnedClientId(context.supabase, context.userId);
    if (!clientId) throw new Error("Forbidden");
    if (data.customRoleId) {
      const { data: cr } = await context.supabase
        .from("client_custom_roles")
        .select("id")
        .eq("id", data.customRoleId)
        .eq("client_id", clientId)
        .maybeSingle();
      if (!cr) throw new Error("Unknown custom role.");
    }
    const { error } = await context.supabase
      .from("client_members")
      .update({
        role: data.customRoleId ? null : data.role ?? null,
        custom_role_id: data.customRoleId ?? null,
      })
      .eq("id", data.memberId)
      .eq("client_id", clientId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeClientMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ memberId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const clientId = await getOwnedClientId(context.supabase, context.userId);
    if (!clientId) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("client_members")
      .delete()
      .eq("id", data.memberId)
      .eq("client_id", clientId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getClientRolePermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: Record<ClientMemberRole, string[]> }> => {
    const clientId = await getOwnedClientId(context.supabase, context.userId);
    const rows: Record<ClientMemberRole, string[]> = {
      client_admin: [...DEFAULT_PERMS.client_admin],
      client_recruiter: [...DEFAULT_PERMS.client_recruiter],
      client_viewer: [...DEFAULT_PERMS.client_viewer],
    };
    if (!clientId) return { rows };
    const { data, error } = await context.supabase
      .from("client_role_permissions")
      .select("role, permissions")
      .eq("client_id", clientId);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      rows[r.role as ClientMemberRole] = (r.permissions ?? []) as string[];
    }
    return { rows };
  });

const UpdatePermsSchema = z.object({
  role: z.enum(["client_recruiter", "client_viewer"]),
  permissions: z.array(z.string().min(1).max(64)).max(64),
});

export const updateClientRolePermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdatePermsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const clientId = await getOwnedClientId(context.supabase, context.userId);
    if (!clientId) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("client_role_permissions")
      .upsert(
        { client_id: clientId, role: data.role, permissions: data.permissions },
        { onConflict: "client_id,role" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Custom roles ----------

export const listClientCustomRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ roles: ClientCustomRole[] }> => {
    const clientId = await getOwnedClientId(context.supabase, context.userId);
    if (!clientId) return { roles: [] };
    const { data, error } = await context.supabase
      .from("client_custom_roles")
      .select("id, name, permissions")
      .eq("client_id", clientId)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return { roles: (data ?? []) as ClientCustomRole[] };
  });

const CreateCustomRoleSchema = z.object({
  name: z.string().min(1).max(64),
  permissions: z.array(z.string().min(1).max(64)).max(64).default([]),
});

export const createClientCustomRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateCustomRoleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const clientId = await getOwnedClientId(context.supabase, context.userId);
    if (!clientId) throw new Error("Forbidden");
    const { data: row, error } = await context.supabase
      .from("client_custom_roles")
      .insert({ client_id: clientId, name: data.name, permissions: data.permissions })
      .select("id, name, permissions")
      .single();
    if (error) throw new Error(error.message);
    return { role: row as ClientCustomRole };
  });

const UpdateCustomRoleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(64).optional(),
  permissions: z.array(z.string().min(1).max(64)).max(64).optional(),
});

export const updateClientCustomRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateCustomRoleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const clientId = await getOwnedClientId(context.supabase, context.userId);
    if (!clientId) throw new Error("Forbidden");
    const patch: { name?: string; permissions?: string[] } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.permissions !== undefined) patch.permissions = data.permissions;
    const { error } = await context.supabase
      .from("client_custom_roles")
      .update(patch)
      .eq("id", data.id)
      .eq("client_id", clientId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteClientCustomRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const clientId = await getOwnedClientId(context.supabase, context.userId);
    if (!clientId) throw new Error("Forbidden");
    const { count, error: cErr } = await context.supabase
      .from("client_members")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("custom_role_id", data.id);
    if (cErr) throw new Error(cErr.message);
    if ((count ?? 0) > 0) throw new Error("Reassign teammates before deleting this role.");
    const { error } = await context.supabase
      .from("client_custom_roles")
      .delete()
      .eq("id", data.id)
      .eq("client_id", clientId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });