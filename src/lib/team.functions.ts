import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InviteSchema = z.object({
  email: z.string().email().max(255),
  fullName: z.string().min(1).max(255),
  role: z.enum(["admin", "recruiter"]),
});

export const inviteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InviteSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Only admins can invite teammates.
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Only admins can invite team members.");

    // 1) Send invite (Supabase emails a magic link; user sets password on first sign-in)
    const redirectTo =
      (process.env.SITE_URL ?? "").replace(/\/$/, "") + "/login" || undefined;

    const { data: invited, error: inviteErr } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
        data: { full_name: data.fullName },
        redirectTo,
      });
    if (inviteErr || !invited?.user) {
      throw new Error(inviteErr?.message ?? "Failed to send invite.");
    }
    const newUserId = invited.user.id;

    // 2) Activate the profile + remove the default 'client' role assigned by trigger
    await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.fullName, status: "active" })
      .eq("id", newUserId);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    const { error: roleInsertErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: data.role });
    if (roleInsertErr) throw new Error(roleInsertErr.message);

    return { ok: true, userId: newUserId };
  });