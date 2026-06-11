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
  ChevronRight,
  User,
} from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";
import { NotificationBell } from "@/components/notification-bell";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

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
  const displayInitials = (profile?.full_name || profile?.email || "SA")
    .split(/[\s@]+/)
    .filter(Boolean)
    .map((p) => p[0]!)
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground sticky top-0 h-screen">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-sidebar-border">
          <div className="size-8 rounded-lg bg-gradient-to-br from-primary to-purple grid place-items-center text-primary-foreground font-bold shadow-sm">
            <ShieldCheck className="size-4" />
          </div>
          <div className="leading-tight">
            <div className="font-semibold tracking-tight">TalentFlow</div>
            <div className="text-[11px] text-muted-foreground">Platform Admin</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
            Platform
          </div>
          <div className="space-y-0.5">
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
                  {active && <ChevronRight className="ml-auto size-3.5 opacity-60" />}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <div className="rounded-lg bg-gradient-to-br from-primary/10 via-purple/10 to-info/10 p-3 border border-sidebar-border">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="size-4 text-primary" />
              Platform Control
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Manage agencies, subscriptions, and platform-wide settings.
            </p>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 sticky top-0 z-20 backdrop-blur bg-background/80 border-b border-border flex items-center gap-3 px-4 md:px-8">
          <div className="md:hidden flex items-center gap-2">
            <div className="size-8 rounded-lg bg-gradient-to-br from-primary to-purple grid place-items-center text-primary-foreground font-bold">
              <ShieldCheck className="size-4" />
            </div>
            <span className="font-semibold">TalentFlow</span>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-primary/25 bg-primary/10 text-primary text-[11px] font-semibold uppercase tracking-wider">
              <ShieldCheck className="size-3.5" /> Super Admin
            </span>
          </div>

          <div className="flex-1" />

          <NotificationBell viewAllHref="/superadmin" />

          <div className="pl-2 border-l border-border">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-md p-1 hover:bg-secondary outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <div className="size-8 rounded-full bg-gradient-to-br from-primary to-purple text-primary-foreground grid place-items-center text-xs font-semibold">
                  {displayInitials}
                </div>
                <div className="hidden sm:block text-xs leading-tight text-left">
                  <div className="font-medium">{displayName}</div>
                  <div className="text-muted-foreground">Super Admin</div>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="cursor-pointer">
                    <User className="size-4" /> Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/superadmin/settings" className="cursor-pointer">
                    <Settings className="size-4" /> Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <button
                    className="cursor-pointer w-full text-left flex items-center gap-2"
                    onClick={async () => {
                      await signOut();
                      navigate({ to: "/login", replace: true });
                    }}
                  >
                    <LogOut className="size-4" /> Sign Out
                  </button>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 px-4 md:px-8 py-6 md:py-8 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}