import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ClientMemberRole = "client_admin" | "client_recruiter" | "client_viewer";

export type ClientMember = {
  id: string;
  user_id: string | null;
  invited_email: string | null;
  full_name: string | null;
  role: ClientMemberRole;
  status: string;
  created_at: string;
};

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
      .select("id, user_id, invited_email, full_name, role, status, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { clientId, members: (data ?? []) as ClientMember[] };
  });

const InviteSchema = z.object({
  email: z.string().email().max(255),
  fullName: z.string().min(1).max(255),
  password: z.string().min(8).max(128),
  role: z.enum(["client_admin", "client_recruiter", "client_viewer"]),
});

export const inviteClientMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InviteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const clientId = await getOwnedClientId(context.supabase, context.userId);
    if (!clientId) throw new Error("Only the client admin can invite team members.");

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
      role: data.role,
      status: "active",
      created_by: context.userId,
    });
    if (insErr) throw new Error(insErr.message);

    return { ok: true, userId: newUserId };
  });

const UpdateRoleSchema = z.object({
  memberId: z.string().uuid(),
  role: z.enum(["client_admin", "client_recruiter", "client_viewer"]),
});

export const updateClientMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateRoleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const clientId = await getOwnedClientId(context.supabase, context.userId);
    if (!clientId) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("client_members")
      .update({ role: data.role })
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