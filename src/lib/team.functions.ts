import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TEAM_ROLES = ["admin", "lead_recruiter", "senior_recruiter", "recruiter"] as const;
const ALL_ROLES = [...TEAM_ROLES, "client"] as const;
type TeamRole = (typeof TEAM_ROLES)[number];

async function assertAdmin(supabase: any, userId: string) {
  const { data: isAdmin, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Only admins can perform this action.");
}

const CreateSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  fullName: z.string().min(1).max(255),
  role: z.enum(TEAM_ROLES),
});

export const createTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.fullName },
      });
    if (createErr || !created?.user) {
      throw new Error(createErr?.message ?? "Failed to create account.");
    }
    const newUserId = created.user.id;

    await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.fullName, status: "active" })
      .eq("id", newUserId);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    const { error: roleInsertErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: data.role });
    if (roleInsertErr) throw new Error(roleInsertErr.message);

    return { ok: true, userId: newUserId, email: data.email };
  });

export const getRolePermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("role_permissions")
      .select("role, permissions");
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as { role: TeamRole | "client"; permissions: string[] }[] };
  });

const UpdateRoleSchema = z.object({
  role: z.enum(ALL_ROLES),
  permissions: z.array(z.string().min(1).max(64)).max(64),
});

export const updateRolePermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UpdateRoleSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.role === "admin") throw new Error("Admin permissions are immutable.");

    const { error } = await supabaseAdmin
      .from("role_permissions")
      .upsert({ role: data.role, permissions: data.permissions });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const CreateClientSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  fullName: z.string().min(1).max(255),
  companyName: z.string().min(1).max(255),
});

export const createClientAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateClientSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: {
          full_name: data.fullName,
          company_name: data.companyName,
        },
      });
    if (createErr || !created?.user) {
      throw new Error(createErr?.message ?? "Failed to create client account.");
    }
    const newUserId = created.user.id;

    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.fullName,
        company_name: data.companyName,
        status: "active",
      })
      .eq("id", newUserId);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    const { error: roleInsertErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: "client" });
    if (roleInsertErr) throw new Error(roleInsertErr.message);

    return { ok: true, userId: newUserId, email: data.email };
  });