import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";

export const Route = createFileRoute("/login")({
  ssr: false,
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { session, roles, profile, loading, profileLoaded } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !session) return;
    if (!profileLoaded) return;
    if (roles.includes("super_admin")) {
      navigate({ to: "/superadmin", replace: true });
    } else if (roles.includes("admin") || roles.includes("lead_recruiter")) {
      navigate({ to: "/dashboard", replace: true });
    } else if (roles.includes("senior_recruiter") || roles.includes("recruiter")) {
      navigate({ to: "/me", replace: true });
    } else if (roles.includes("client")) {
      navigate({ to: "/client", replace: true });
    }
  }, [loading, profileLoaded, session, roles, profile, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) setError(error.message);
  };

  return (
    <div className="min-h-screen grid place-items-center bg-[#0b0807] text-white px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 font-bold text-black">T</div>
          <span className="font-semibold tracking-tight">TalentFlow</span>
        </Link>
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 shadow-2xl">
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="text-xs text-white/60 mt-1">Welcome back. Enter your credentials to continue.</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-3">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-white/60">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full h-10 rounded-md bg-white/5 border border-white/10 px-3 text-sm outline-none focus:ring-2 focus:ring-orange-400/40"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-white/60">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full h-10 rounded-md bg-white/5 border border-white/10 px-3 text-sm outline-none focus:ring-2 focus:ring-orange-400/40"
              />
            </div>
            {error && <div className="text-xs text-rose-400">{error}</div>}
            <button
              type="submit"
              disabled={submitting || (!!session && !profileLoaded)}
              className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-md bg-gradient-to-b from-orange-400 to-orange-600 text-black font-semibold text-sm hover:brightness-110 transition disabled:opacity-50"
            >
              {submitting || (!!session && !profileLoaded) ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>Sign in <ArrowRight className="size-4" /></>
              )}
            </button>
            {(!!session && !profileLoaded) && (
              <p className="text-[11px] text-white/50 text-center animate-pulse">Signing you in…</p>
            )}
          </form>
          <div className="mt-4 text-xs text-white/60 text-center">
            New here?{" "}
            <Link to="/signup" className="text-orange-400 font-medium hover:underline">
              Create an account
            </Link>
          </div>
          <div className="mt-2 text-[11px] text-white/40 text-center">
            Hiring client?{" "}
            <Link to="/client/login" className="hover:text-white/70 underline">Use the client portal</Link>
          </div>
        </div>
      </div>
    </div>
  );
}