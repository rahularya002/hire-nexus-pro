import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";

export const Route = createFileRoute("/client/login")({
  ssr: false,
  component: ClientLoginPage,
});

function ClientLoginPage() {
  const navigate = useNavigate();
  const { session, roles, profile, loading, profileLoaded } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !session || !profileLoaded) return;
    if (roles.includes("client")) {
      navigate({ to: "/client", replace: true });
    } else if (roles.includes("admin") || roles.includes("recruiter") || roles.includes("lead_recruiter") || roles.includes("senior_recruiter")) {
      navigate({ to: "/dashboard", replace: true });
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
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 font-bold text-white">
            <Building2 className="size-5" />
          </div>
          <span className="font-semibold tracking-tight">TalentFlow · Client Portal</span>
        </Link>
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 shadow-2xl">
          <h1 className="text-xl font-semibold">Client sign in</h1>
          <p className="text-xs text-white/60 mt-1">Access your hiring workspace, review candidates, and chat with your account team.</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-3">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-white/60">Work email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full h-10 rounded-md bg-white/5 border border-white/10 px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-400/40"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-white/60">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full h-10 rounded-md bg-white/5 border border-white/10 px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-400/40"
              />
            </div>
            {error && <div className="text-xs text-rose-400">{error}</div>}
            <button
              type="submit"
              disabled={submitting || (!!session && !profileLoaded)}
              className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-md bg-gradient-to-b from-indigo-400 to-indigo-600 text-white font-semibold text-sm hover:brightness-110 transition disabled:opacity-50"
            >
              {submitting || (!!session && !profileLoaded) ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>Sign in <ArrowRight className="size-4" /></>
              )}
            </button>
          </form>
          <div className="mt-4 text-xs text-white/60 text-center">
            New client?{" "}
            <Link to="/client/signup" className="text-indigo-400 font-medium hover:underline">
              Request access
            </Link>
          </div>
          <div className="mt-2 text-[11px] text-white/40 text-center">
            Recruiter or admin?{" "}
            <Link to="/login" className="hover:text-white/70 underline">Agency sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}