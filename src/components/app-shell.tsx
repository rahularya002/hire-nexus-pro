import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  Briefcase,
  Activity,
  CalendarClock,
  Workflow,
  CheckCircle2,
  Users,
  Bell,
  Search,
  Sparkles,
  Settings,
  ChevronRight,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTrackAgencyPath } from "@/lib/portal-state";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/clients", label: "Active Clients", icon: Building2 },
  { to: "/positions", label: "Open Requirements", icon: Briefcase },
  { to: "/ongoing", label: "Ongoing", icon: Activity },
  { to: "/interviews", label: "Interviews", icon: CalendarClock },
  { to: "/pipeline", label: "Pipeline", icon: Workflow },
  { to: "/closed", label: "Closed", icon: CheckCircle2 },
  { to: "/admin/clients", label: "Clients (Admin)", icon: Users },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useTrackAgencyPath();

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-sidebar-border">
          <div className="size-8 rounded-lg bg-gradient-to-br from-primary to-purple grid place-items-center text-primary-foreground font-bold shadow-sm">
            T
          </div>
          <div className="leading-tight">
            <div className="font-semibold tracking-tight">TalentFlow</div>
            <div className="text-[11px] text-muted-foreground">Recruitment OS</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <div className="px-2 pb-2 text-[11px] uppercase tracking-wider text-muted-foreground">Workspace</div>
          {nav.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
                {active && <ChevronRight className="ml-auto size-3.5 opacity-60" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <div className="rounded-lg bg-gradient-to-br from-primary/10 via-purple/10 to-info/10 p-3 border border-sidebar-border">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-primary" />
              AI Talent Scout
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Auto-source matched candidates for any open role.
            </p>
            <Link to="/scout" className="mt-3 w-full inline-flex items-center justify-center text-xs font-medium bg-primary text-primary-foreground rounded-md py-1.5 hover:bg-primary/90 transition">
              Try Scout
            </Link>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 sticky top-0 z-20 backdrop-blur bg-background/80 border-b border-border flex items-center gap-3 px-4 md:px-8">
          <div className="md:hidden flex items-center gap-2">
            <div className="size-8 rounded-lg bg-gradient-to-br from-primary to-purple grid place-items-center text-primary-foreground font-bold">T</div>
            <span className="font-semibold">TalentFlow</span>
          </div>

          <div className="hidden md:flex items-center gap-2 flex-1 max-w-xl">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                placeholder="Search candidates, clients, positions..."
                className="w-full h-10 rounded-lg border border-input bg-secondary/50 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/40 focus:bg-background"
              />
            </div>
          </div>

          <div className="flex-1 md:hidden" />

          <button className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition">
            <Plus className="size-4" /> New Position
          </button>

          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-success/10 text-success text-xs font-medium">
            <span className="size-1.5 rounded-full bg-success animate-pulse" />
            Live
          </div>

          <button className="relative size-9 grid place-items-center rounded-md hover:bg-secondary">
            <Bell className="size-4" />
            <span className="absolute top-2 right-2 size-1.5 rounded-full bg-destructive" />
          </button>
          <button className="size-9 grid place-items-center rounded-md hover:bg-secondary">
            <Settings className="size-4" />
          </button>

          <div className="flex items-center gap-2 pl-2 ml-1 border-l border-border">
            <div className="size-8 rounded-full bg-gradient-to-br from-primary to-purple text-primary-foreground grid place-items-center text-xs font-semibold">
              AR
            </div>
            <div className="hidden sm:block text-xs leading-tight">
              <div className="font-medium">Aarav Reddy</div>
              <div className="text-muted-foreground">Senior Recruiter</div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 md:px-8 py-6 md:py-8 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}