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

export const getTeamMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profiles, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, status, created_at");
    if (profErr) throw new Error(profErr.message);

    const { data: roles, error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (roleErr) throw new Error(roleErr.message);

    const roleMap = new Map(roles?.map((r) => [r.user_id, r.role as TeamRole | "client"]) ?? []);

    const members = (profiles ?? [])
      .filter((p) => {
        const r = roleMap.get(p.id);
        return r && r !== "client";
      })
      .map((p) => {
        const role = roleMap.get(p.id) ?? "recruiter";
        const name = p.full_name ?? p.email ?? "Unknown";
        const initials = name.split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();
        const joinedOn = p.created_at
          ? new Date(p.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })
          : "—";
        const status = p.status === "active" ? "Active" : p.status === "pending" ? "Available" : "Offline";
        return {
          id: p.id,
          name,
          initials,
          role: role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          status,
          loginAt: "—",
          assignedClients: 0,
          assignedPositions: 0,
          sharesToday: 0,
          closuresMtd: 0,
          conversionPct: 0,
          joinedOn,
        };
      });

    return { members };
  });

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

export type ClientAccountMember = {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: string;
  owned: { id: string; title: string; location: string | null }[];
};

/**
 * Returns the recruiters assigned to the requesting client's positions,
 * plus the positions each one owns. Used by the client portal "Account Team" page.
 */
export const getClientAccountTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ members: ClientAccountMember[] }> => {
    const { supabase, userId } = context;
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!client?.id) return { members: [] };

    const { data: positions, error: pErr } = await supabase
      .from("positions")
      .select("id, title, location, assigned_recruiter_id")
      .eq("client_id", client.id);
    if (pErr) throw new Error(pErr.message);

    const recruiterIds = Array.from(
      new Set(
        (positions ?? [])
          .map((p) => p.assigned_recruiter_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    if (recruiterIds.length === 0) return { members: [] };

    const [{ data: profs }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, email").in("id", recruiterIds),
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", recruiterIds),
    ]);
    const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role as string]));

    const members: ClientAccountMember[] = (profs ?? []).map((p) => {
      const name = p.full_name ?? p.email ?? "Recruiter";
      const initials = name
        .split(/\s+/)
        .map((s) => s[0] ?? "")
        .join("")
        .slice(0, 2)
        .toUpperCase();
      const owned = (positions ?? [])
        .filter((pp) => pp.assigned_recruiter_id === p.id)
        .map((pp) => ({ id: pp.id, title: pp.title, location: pp.location }));
      const rawRole = roleMap.get(p.id) ?? "recruiter";
      return {
        id: p.id,
        name,
        initials,
        email: p.email ?? "—",
        role: rawRole.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        owned,
      };
    });
    return { members };
  });