import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RecruiterLoginToday = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  first_login_at: string | null;
  last_login_at: string | null;
  logged_in_today: boolean;
};

/**
 * Record a login event for the current user. Idempotent per UTC day —
 * a unique index on (user_id, login_date) collapses repeat logins into
 * the first event of the day.
 */
export const recordLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: membership } = await supabase
      .from("agency_members")
      .select("agency_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!membership?.agency_id) return { ok: true, recorded: false };

    const { error } = await supabase
      .from("recruiter_login_events")
      .insert({ user_id: userId, agency_id: membership.agency_id });

    // Unique-violation = already logged in today; that's success.
    if (error && !/duplicate key|unique/i.test(error.message)) {
      throw new Error(error.message);
    }
    return { ok: true, recorded: !error };
  });

/**
 * List today's logins for every recruiter in the caller's agency, with
 * first and last login timestamps for the day.
 */
export const listTodayRecruiterLogins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RecruiterLoginToday[]> => {
    const { supabase, userId } = context;

    const { data: callerMembership } = await supabase
      .from("agency_members")
      .select("agency_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!callerMembership?.agency_id) return [];
    const agencyId = callerMembership.agency_id;

    const { data: members, error: mErr } = await supabase
      .from("agency_members")
      .select("user_id, role_in_agency")
      .eq("agency_id", agencyId);
    if (mErr) throw new Error(mErr.message);
    const memberIds = (members ?? []).map((m) => m.user_id);
    if (memberIds.length === 0) return [];

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [{ data: profiles }, { data: events }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", memberIds),
      supabase
        .from("recruiter_login_events")
        .select("user_id, occurred_at")
        .eq("agency_id", agencyId)
        .gte("occurred_at", startOfDay.toISOString())
        .order("occurred_at", { ascending: true }),
    ]);

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, p]),
    );
    const roleMap = new Map(
      (members ?? []).map((m) => [m.user_id, m.role_in_agency]),
    );

    const firstByUser = new Map<string, string>();
    const lastByUser = new Map<string, string>();
    for (const e of events ?? []) {
      if (!firstByUser.has(e.user_id)) firstByUser.set(e.user_id, e.occurred_at);
      lastByUser.set(e.user_id, e.occurred_at);
    }

    return memberIds.map((id) => {
      const p = profileMap.get(id);
      const first = firstByUser.get(id) ?? null;
      return {
        user_id: id,
        full_name: p?.full_name ?? null,
        email: p?.email ?? null,
        role: roleMap.get(id) ?? null,
        first_login_at: first,
        last_login_at: lastByUser.get(id) ?? null,
        logged_in_today: !!first,
      };
    });
  });