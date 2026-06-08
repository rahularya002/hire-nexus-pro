import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

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
  can: (perm: string) => boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | undefined>(undefined);

async function loadProfileAndRoles(userId: string): Promise<{ profile: Profile | null; roles: AppRole[]; permissions: string[] }> {
  const [pRes, rRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, company_name, status").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  const roles = ((rRes.data ?? []) as { role: AppRole }[]).map((r) => r.role);

  let permissions: string[] = [];
  if (roles.length) {
    const { data: rpRows } = await supabase
      .from("role_permissions")
      .select("role, permissions")
      .in("role", roles);
    const set = new Set<string>();
    ((rpRows ?? []) as { role: AppRole; permissions: string[] }[]).forEach((r) =>
      r.permissions.forEach((p) => set.add(p))
    );
    permissions = [...set];
  }

  return {
    profile: (pRes.data as Profile | null) ?? null,
    roles,
    permissions,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    // 1) Subscribe FIRST so we don't miss events.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (sess?.user) {
        setProfileLoaded(false);
        // Defer the supabase calls so we don't deadlock the callback.
        setTimeout(() => {
          loadProfileAndRoles(sess.user.id).then(({ profile, roles, permissions }) => {
            setProfile(profile);
            setRoles(roles);
            setPermissions(permissions);
            setProfileLoaded(true);
          });
        }, 0);
      } else {
        setProfile(null);
        setRoles([]);
        setPermissions([]);
        setProfileLoaded(true);
      }
      router.invalidate();
      qc.invalidateQueries();
    });

    // 2) Then load existing session.
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        const { profile, roles, permissions } = await loadProfileAndRoles(data.session.user.id);
        setProfile(profile);
        setRoles(roles);
        setPermissions(permissions);
        setProfileLoaded(true);
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
    can: (perm: string) => roles.includes("admin") || permissions.includes(perm),
    signOut: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
    },
    refresh: async () => {
      if (!session?.user) return;
      const { profile, roles, permissions } = await loadProfileAndRoles(session.user.id);
      setProfile(profile);
      setRoles(roles);
      setPermissions(permissions);
      setProfileLoaded(true);
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