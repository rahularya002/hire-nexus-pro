import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth/auth-context";

type Variant = "agency" | "client";

function FullScreenLoader() {
  return (
    <div className="min-h-screen grid place-items-center bg-background text-muted-foreground text-sm">
      Loading…
    </div>
  );
}

export function AuthGate({ variant, children }: { variant: Variant; children: React.ReactNode }) {
  const { loading, profileLoaded, session, profile, roles } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/login", replace: true });
      return;
    }
    if (!profileLoaded) return;
    const isAgency =
      roles.includes("admin") ||
      roles.includes("lead_recruiter") ||
      roles.includes("senior_recruiter") ||
      roles.includes("recruiter");
    const isClient = roles.includes("client");

    if (variant === "agency") {
      if (!isAgency) {
        if (isClient) navigate({ to: "/client", replace: true });
        else navigate({ to: "/login", replace: true });
      }
    } else {
      if (!isClient) {
        if (isAgency) navigate({ to: "/dashboard", replace: true });
        else navigate({ to: "/login", replace: true });
        return;
      }
    }
  }, [loading, profileLoaded, session, profile, roles, variant, navigate]);

  if (loading || !session || !profileLoaded) return <FullScreenLoader />;
  const isAgency =
    roles.includes("admin") ||
    roles.includes("lead_recruiter") ||
    roles.includes("senior_recruiter") ||
    roles.includes("recruiter");
  const isClient = roles.includes("client");
  if (variant === "agency" && !isAgency) return <FullScreenLoader />;
  if (variant === "client" && !isClient) return <FullScreenLoader />;

  return <>{children}</>;
}