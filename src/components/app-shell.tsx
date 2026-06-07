import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  Briefcase,
  Activity,
  CalendarClock,
  Workflow,
  CheckCircle2,
  Bell,
  Search,
  Sparkles,
  Settings,
  ChevronRight,
  Plus,
  ClipboardList,
  UsersRound,
  Database,
  Receipt,
  MessageSquare,
  LogOut,
  User,
  Home,
  Coffee,
  CircleOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTrackAgencyPath } from "@/lib/portal-state";
import { useCurrentRecruiter, useMyRole, useCan, setMyStatus, type PermKey } from "@/lib/ops/access";
import type { RecruiterStatus } from "@/lib/ops/store";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/lib/auth/auth-context";
import { useNavigate } from "@tanstack/react-router";
import { NotificationBell } from "@/components/notification-bell";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type NavItem = { to: string; label: string; icon: typeof Home; exact?: boolean; perm?: string };
type NavSection = { label: string; items: NavItem[] };

const agencyNav: NavSection[] = [
  {
    label: "Overview",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { to: "/tasks",     label: "Tasks",     icon: ClipboardList },
      { to: "/messages",  label: "Messages",  icon: MessageSquare },
    ],
  },
  {
    label: "Hiring Pipeline",
    items: [
      { to: "/positions",  label: "Open Requirements", icon: Briefcase },
      { to: "/ongoing",    label: "Ongoing",           icon: Activity },
      { to: "/interviews", label: "Interviews",        icon: CalendarClock },
      { to: "/pipeline",   label: "Pipeline",          icon: Workflow },
      { to: "/closed",     label: "Closed",            icon: CheckCircle2 },
    ],
  },
  {
    label: "Talent & Clients",
    items: [
      { to: "/database",      label: "Candidate DB", icon: Database },
      { to: "/admin/clients", label: "Clients",      icon: Building2 },
    ],
  },
  {
    label: "Team & Operations",
    items: [
      { to: "/team",     label: "Recruiter Roster",   icon: UsersRound },
      { to: "/activity", label: "Recruiter Activity", icon: Activity },
      { to: "/billing",  label: "Billing",            icon: Receipt },
    ],
  },
];

const recruiterNav: NavSection[] = [
  {
    label: "Overview",
    items: [
      { to: "/me",    label: "My Desk", icon: Home, exact: true },
      { to: "/tasks", label: "Tasks",   icon: ClipboardList, perm: "candidates.view" },
    ],
  },
  {
    label: "Hiring Pipeline",
    items: [
      { to: "/positions",  label: "Open Requirements", icon: Briefcase,     perm: "positions.view" },
      { to: "/interviews", label: "Interviews",        icon: CalendarClock, perm: "candidates.view" },
      { to: "/pipeline",   label: "Pipeline",          icon: Workflow,      perm: "pipeline.move" },
    ],
  },
  {
    label: "Talent",
    items: [
      { to: "/database", label: "Candidate DB", icon: Database, perm: "candidates.view" },
    ],
  },
  {
    label: "Team",
    items: [
      { to: "/team",     label: "Recruiter Roster", icon: UsersRound, perm: "team.view" },
      { to: "/activity", label: "My Activity",      icon: Activity },
    ],
  },
];

const STATUS_OPTS: { value: RecruiterStatus; label: string; dot: string; cls: string; Icon: typeof Home }[] = [
  { value: "Available", label: "Available", dot: "bg-info",             cls: "text-info",             Icon: User },
  { value: "Active",    label: "Active",    dot: "bg-success",          cls: "text-success",          Icon: Activity },
  { value: "Break",     label: "On Break",  dot: "bg-warning",          cls: "text-warning",          Icon: Coffee },
  { value: "Offline",   label: "Offline",   dot: "bg-muted-foreground", cls: "text-muted-foreground", Icon: CircleOff },
];
function statusOpt(s: RecruiterStatus) { return STATUS_OPTS.find((x) => x.value === s) ?? STATUS_OPTS[3]; }

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate variant="agency">
      <AppShellInner>{children}</AppShellInner>
    </AuthGate>
  );
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useTrackAgencyPath();
  const me = useCurrentRecruiter();
  const role = useMyRole();
  const can = useCan();
  const { profile, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const meStatus = statusOpt(me.status);
  const isAgencyLead = roles.includes("admin") || roles.includes("lead_recruiter");
  const baseNav = isAgencyLead ? agencyNav : recruiterNav;
  const nav = baseNav;

  // Real authenticated identity (overrides mock recruiter for display)
  const displayName = profile?.full_name || profile?.email || "Account";
  const displayInitials = (profile?.full_name || profile?.email || "?")
    .split(/[\s@]+/)
    .filter(Boolean)
    .map((p) => p[0]!)
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const ROLE_LABEL: Record<string, string> = {
    admin: "Admin",
    lead_recruiter: "Lead Recruiter",
    senior_recruiter: "Senior Recruiter",
    recruiter: "Recruiter",
    client: "Client",
  };
  const primaryRole = roles[0];
  const displayRole = primaryRole ? (ROLE_LABEL[primaryRole] ?? primaryRole) : role.name;
  const isAdmin = roles.includes("admin");

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground sticky top-0 h-screen">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-sidebar-border">
          <div className="size-8 rounded-lg bg-gradient-to-br from-primary to-purple grid place-items-center text-primary-foreground font-bold shadow-sm">
            T
          </div>
          <div className="leading-tight">
            <div className="font-semibold tracking-tight">TalentFlow</div>
            <div className="text-[11px] text-muted-foreground">Recruitment OS</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {nav
            .map((section) => ({
              ...section,
              items: section.items.filter((i) => !i.perm || can(i.perm as PermKey)),
            }))
            .filter((section) => section.items.length > 0)
            .map((section, idx) => (
              <div key={section.label} className={cn(idx > 0 && "mt-5")}>
                <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
                  {section.label}
                </div>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
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
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <Icon className="size-4" />
                        <span>{item.label}</span>
                        {active && <ChevronRight className="ml-auto size-3.5 opacity-60" />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
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

          <Link to="/positions" className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition">
            <Plus className="size-4" /> New Position
          </Link>

          {/* Status pill */}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-border bg-card hover:bg-secondary/60 text-xs font-medium outline-none focus-visible:ring-1 focus-visible:ring-ring transition">
              <span className={cn("size-1.5 rounded-full", meStatus.dot, me.status === "Active" && "animate-pulse")} />
              <span className={meStatus.cls}>{meStatus.label}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Set my status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {STATUS_OPTS.map((s) => (
                <DropdownMenuItem key={s.value} onClick={() => setMyStatus(s.value)} className="cursor-pointer">
                  <span className={cn("size-2 rounded-full mr-2", s.dot)} />
                  {s.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <NotificationBell viewAllHref="/activity" />

          <div className="pl-2 border-l border-border">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-md p-1 hover:bg-secondary outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <div className="relative size-8 rounded-full bg-gradient-to-br from-primary to-purple text-primary-foreground grid place-items-center text-xs font-semibold">
                  {displayInitials}
                  <span className={cn("absolute -bottom-0.5 -right-0.5 size-2 rounded-full ring-2 ring-background", meStatus.dot)} />
                </div>
                <div className="hidden sm:block text-xs leading-tight text-left">
                  <div className="font-medium">{displayName}</div>
                  <div className="text-muted-foreground capitalize">{displayRole}</div>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {!isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/me" className="cursor-pointer">
                      <Home className="size-4" /> My Desk
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="cursor-pointer">
                    <User className="size-4" /> Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="cursor-pointer">
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