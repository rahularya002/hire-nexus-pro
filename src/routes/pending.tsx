import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Clock, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";

export const Route = createFileRoute("/pending")({
  ssr: false,
  component: PendingPage,
});

function PendingPage() {
  const { session, profile, roles, loading, profileLoaded, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/login", replace: true });
      return;
    }
    if (!profileLoaded) return;
    if (roles.includes("admin") || roles.includes("recruiter")) {
      navigate({ to: "/dashboard", replace: true });
      return;
    }
    if (roles.includes("client") && profile?.status === "active") {
      navigate({ to: "/client", replace: true });
    }
  }, [loading, profileLoaded, session, roles, profile, navigate]);

  return (
    <div className="min-h-screen grid place-items-center bg-[#0b0807] text-white px-4">
      <div className="w-full max-w-md text-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-8">
        <div className="mx-auto size-12 rounded-full bg-orange-500/20 grid place-items-center text-orange-400">
          <Clock className="size-6" />
        </div>
        <h1 className="mt-4 text-xl font-semibold">
          {profile?.status === "rejected" ? "Access request declined" : "Awaiting approval"}
        </h1>
        <p className="mt-2 text-sm text-white/60">
          {profile?.status === "rejected"
            ? "Your account was declined by an administrator. Reach out to the TalentFlow team if you think this is a mistake."
            : "Your account is pending review. An administrator will approve your access shortly."}
        </p>
        <button
          onClick={async () => {
            await signOut();
            navigate({ to: "/login", replace: true });
          }}
          className="mt-6 inline-flex items-center gap-2 h-10 px-4 rounded-md border border-white/15 bg-white/5 text-sm hover:bg-white/10 transition"
        >
          <LogOut className="size-4" /> Sign out
        </button>
        <div className="mt-4 text-xs text-white/40">
          <Link to="/" className="hover:text-white/70">Back to home</Link>
        </div>
      </div>
    </div>
  );
}