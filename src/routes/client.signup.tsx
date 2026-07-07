import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Loader2, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/client/signup")({
  ssr: false,
  component: ClientSignupPage,
});

function ClientSignupPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/client/login`,
        data: { full_name: fullName, company_name: companyName, intended_role: "client" },
      },
    });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigate({ to: "/client/login", replace: true });
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white px-4 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 font-bold text-white">
            <Building2 className="size-5" />
          </div>
          <span className="font-semibold tracking-tight">TalentFlow · Client Portal</span>
        </Link>
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 shadow-2xl">
          <h1 className="text-xl font-semibold">Request client access</h1>
          <p className="text-xs text-white/60 mt-1">
            Your TalentFlow account team will approve your workspace shortly after sign-up.
          </p>
          <form onSubmit={onSubmit} className="mt-6 space-y-3">
            <Field label="Full name" value={fullName} onChange={setFullName} required />
            <Field label="Company" value={companyName} onChange={setCompanyName} required />
            <Field label="Work email" type="email" value={email} onChange={setEmail} required />
            <Field label="Password" type="password" value={password} onChange={setPassword} required />
            {error && <div className="text-xs text-rose-400">{error}</div>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-md bg-gradient-to-b from-indigo-400 to-indigo-600 text-white font-semibold text-sm hover:brightness-110 transition disabled:opacity-50"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <>Request access <ArrowRight className="size-4" /></>}
            </button>
          </form>
          <div className="mt-4 text-xs text-white/60 text-center">
            Already have access?{" "}
            <Link to="/client/login" className="text-indigo-400 font-medium hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wider text-white/60">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full h-10 rounded-md bg-white/5 border border-white/10 px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-400/40"
      />
    </div>
  );
}