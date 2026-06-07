import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  DollarSign,
  BarChart3,
  LifeBuoy,
  LogOut,
  ShieldCheck,
  Settings,
} from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";

const NAV = [
  { to: "/superadmin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/superadmin/agencies", label: "Agencies", icon: Building2 },
  { to: "/superadmin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { to: "/superadmin/revenue", label: "Revenue", icon: DollarSign },
  { to: "/superadmin/usage", label: "Usage", icon: BarChart3 },
  { to: "/superadmin/support", label: "Support", icon: LifeBuoy },
  { to: "/superadmin/settings", label: "Master Settings", icon: Settings },
];

function FullScreenLoader() {
  return (
    <div className="min-h-screen grid place-items-center bg-background text-muted-foreground text-sm">
      Loading…
    </div>
  );
}

export function SuperAdminShell({ children }: { children: React.ReactNode }) {
  const { loading, profileLoaded, session, roles, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isSuper = roles.includes("super_admin");

  useEffect(() => {
    if (loading || !profileLoaded) return;
    if (!session) {
      navigate({ to: "/login", replace: true });
      return;
    }
    if (!isSuper) {
      navigate({ to: "/", replace: true });
    }
  }, [loading, profileLoaded, session, isSuper, navigate]);

  if (loading || !profileLoaded || !session || !isSuper) return <FullScreenLoader />;

  const displayName = profile?.full_name || profile?.email || "Super Admin";

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground sticky top-0 h-screen">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-sidebar-border">
          <div className="size-8 rounded-lg bg-gradient-to-br from-rose-500 to-amber-500 grid place-items-center text-white font-bold shadow-sm">
            <ShieldCheck className="size-4" />
          </div>
          <div className="leading-tight">
            <div className="font-semibold tracking-tight">Platform Admin</div>
            <div className="text-[11px] text-muted-foreground">SaaS Control</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.to
              : pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-2">
          <div className="text-xs text-muted-foreground">{displayName}</div>
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/login", replace: true });
            }}
            className="w-full inline-flex items-center justify-center gap-2 h-8 rounded-md border border-border text-xs hover:bg-secondary transition"
          >
            <LogOut className="size-3.5" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 sticky top-0 z-20 backdrop-blur bg-background/80 border-b border-border flex items-center gap-3 px-4 md:px-8">
          <div className="text-sm font-medium">Super Admin</div>
          <div className="ml-auto text-xs text-muted-foreground">
            Logged in as <span className="font-medium text-foreground">{displayName}</span>
          </div>
        </header>
        <main className="flex-1 px-4 md:px-8 py-6 md:py-8 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}