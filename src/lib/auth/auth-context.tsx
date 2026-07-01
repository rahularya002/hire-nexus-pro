import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { getMyClientContext, type MyClientContext } from "@/lib/client-team.functions";

export type AppRole =
  | "admin"
  | "lead_recruiter"
  | "senior_recruiter"
  | "recruiter"
  | "client"
  | "super_admin";
export type ProfileStatus = "pending" | "active" | "rejected";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  company_name: string | null;
  status: ProfileStatus;
};

type AuthState = {
  loading: boolean;
  profileLoaded: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  permissions: string[];
  clientContext: MyClientContext | null;
  can: (perm: string) => boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | undefined>(undefined);

// Essential gate-data: profile + roles. AuthGate only needs these two to
// decide where to send the user, so we keep this fast (2 parallel queries).
async function loadEssential(userId: string): Promise<{ profile: Profile | null; roles: AppRole[] }> {
  const [pRes, rRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, company_name, status").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  const roles = ((rRes.data ?? []) as { role: AppRole }[]).map((r) => r.role);
  return { profile: (pRes.data as Profile | null) ?? null, roles };
}

// Secondary data — permissions + client context. Loaded in the background
// so the dashboard / portal can render immediately.
async function loadSecondary(roles: AppRole[]): Promise<{ permissions: string[]; clientContext: MyClientContext | null }> {
  const [permissions, clientContext] = await Promise.all([
    (async () => {
      if (!roles.length) return [] as string[];
      const { data: rpRows } = await supabase
        .from("role_permissions")
        .select("role, permissions")
        .in("role", roles);
      const set = new Set<string>();
      ((rpRows ?? []) as { role: AppRole; permissions: string[] }[]).forEach((r) =>
        r.permissions.forEach((p) => set.add(p))
      );
      return [...set];
    })(),
    (async () => {
      if (!roles.includes("client")) return null;
      try { return await getMyClientContext(); } catch { return null; }
    })(),
  ]);
  return { permissions, clientContext };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [clientContext, setClientContext] = useState<MyClientContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    // 1) Subscribe FIRST so we don't miss events.
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      // Only react to identity transitions. Ignore TOKEN_REFRESHED (fires ~hourly
      // and on tab focus) and INITIAL_SESSION (fires on every mount) — those
      // would otherwise reset profileLoaded and cause /pending to flash.
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") {
        return;
      }
      setSession(sess);
      if (sess?.user) {
        setProfileLoaded(false);
        // Record a daily login event (idempotent per UTC day, throttled
        // client-side so we don't hit the server on every tab focus).
        try {
          const today = new Date().toISOString().slice(0, 10);
          const key = `recruiter-login-recorded:${sess.user.id}`;
          if (typeof window !== "undefined" && window.localStorage.getItem(key) !== today) {
            window.localStorage.setItem(key, today);
            import("@/lib/logins.functions").then(({ recordLogin }) => {
              recordLogin().catch(() => {});
            }).catch(() => {});
          }
        } catch { /* ignore */ }
        // Defer the supabase calls so we don't deadlock the callback.
        setTimeout(() => {
          loadEssential(sess.user.id).then(({ profile, roles }) => {
            setProfile(profile);
            setRoles(roles);
            setProfileLoaded(true);
            // Fire secondary in the background — doesn't block the gate.
            loadSecondary(roles).then(({ permissions, clientContext }) => {
              setPermissions(permissions);
              setClientContext(clientContext);
            });
          });
        }, 0);
      } else {
        setProfile(null);
        setRoles([]);
        setPermissions([]);
        setClientContext(null);
        setProfileLoaded(true);
      }
      if (event === "SIGNED_OUT") {
        // Avoid re-running loaders/queries against the just-cleared session
        // (they'd 401 with "No authorization header"). Send the user to
        // /login; AuthGate on the next mount will handle routing.
        qc.cancelQueries();
        qc.clear();
        router.navigate({ to: "/login", replace: true });
      } else {
        router.invalidate();
        qc.invalidateQueries();
      }
    });

    // 2) Then load existing session.
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        try {
          const today = new Date().toISOString().slice(0, 10);
          const key = `recruiter-login-recorded:${data.session.user.id}`;
          if (typeof window !== "undefined" && window.localStorage.getItem(key) !== today) {
            window.localStorage.setItem(key, today);
            import("@/lib/logins.functions").then(({ recordLogin }) => {
              recordLogin().catch(() => {});
            }).catch(() => {});
          }
        } catch { /* ignore */ }
        const { profile, roles } = await loadEssential(data.session.user.id);
        setProfile(profile);
        setRoles(roles);
        setProfileLoaded(true);
        setLoading(false);
        // Background — non-blocking.
        loadSecondary(roles).then(({ permissions, clientContext }) => {
          setPermissions(permissions);
          setClientContext(clientContext);
        });
        return;
      } else {
        setProfileLoaded(true);
      }
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [router, qc]);

  const value: AuthState = {
    loading,
    profileLoaded,
    session,
    user: session?.user ?? null,
    profile,
    roles,
    permissions,
    clientContext,
    can: (perm: string) => roles.includes("admin") || permissions.includes(perm),
    signOut: async () => {
      await qc.cancelQueries();
      qc.clear();
      await supabase.auth.signOut();
    },
    refresh: async () => {
      if (!session?.user) return;
      const { profile, roles } = await loadEssential(session.user.id);
      setProfile(profile);
      setRoles(roles);
      setProfileLoaded(true);
      const { permissions, clientContext } = await loadSecondary(roles);
      setPermissions(permissions);
      setClientContext(clientContext);
    },
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}

export function useHasRole(role: AppRole): boolean {
  const { roles } = useAuth();
  return roles.includes(role);
}

export function useIsAgencyUser(): boolean {
  const { roles } = useAuth();
  return (
    roles.includes("admin") ||
    roles.includes("lead_recruiter") ||
    roles.includes("senior_recruiter") ||
    roles.includes("recruiter")
  );
}