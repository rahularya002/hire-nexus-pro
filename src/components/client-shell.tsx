import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Briefcase, Upload, FileText, Settings, Bell, Search, ArrowLeft, LogOut, Workflow, CalendarClock, CheckCircle2, BarChart3, Activity as ActivityIcon, UsersRound, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { clientCompany } from "@/lib/client-data";
import { activityEvents } from "@/lib/client-data";
import { getAgencyLastPath, getSelectedClientId, setSelectedClientId } from "@/lib/portal-state";
import { clients } from "@/lib/mock-data";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

const nav = [
  { to: "/client",            label: "Overview",        icon: LayoutDashboard, exact: true },
  { to: "/client/positions",  label: "My Requirements", icon: Briefcase },
  { to: "/client/pipeline",   label: "Pipeline",        icon: Workflow },
  { to: "/client/interviews", label: "Interviews",      icon: CalendarClock },
  { to: "/client/placements", label: "Placements",      icon: CheckCircle2 },
  { to: "/client/reports",    label: "Reports",         icon: BarChart3 },
  { to: "/client/activity",   label: "Activity",        icon: ActivityIcon },
  { to: "/client/team",       label: "Account Team",    icon: UsersRound },
  { to: "/client/messages",   label: "Messages",        icon: MessageSquare },
  { to: "/client/upload",     label: "Upload JD",       icon: Upload },
  { to: "/client/documents",  label: "Documents",       icon: FileText },
];

// Map an agency route path to a human-readable page name.
function describeAgencyPath(path: string): string {
  if (!path || path === "/") return "Dashboard";
  // /clients/:id  → "{Client name}"
  const clientMatch = path.match(/^\/clients\/([^/]+)$/);
  if (clientMatch) {
    const c = clients.find((x) => x.id === clientMatch[1]);
    return c ? c.name : "Client";
  }
  // /positions/:id → "Position detail"
  if (/^\/positions\/[^/]+$/.test(path)) return "Position detail";
  // /admin/clients → "Clients (Admin)"
  if (path.startsWith("/admin/clients")) return "Clients (Admin)";
  const labels: Record<string, string> = {
    "/clients": "Active Clients",
    "/positions": "Open Requirements",
    "/ongoing": "Ongoing",
    "/interviews": "Interviews",
    "/pipeline": "Pipeline",
    "/closed": "Closed",
  };
  if (labels[path]) return labels[path];
  // Fallback: prettify the first segment.
  const seg = path.split("/").filter(Boolean)[0] ?? "";
  return seg ? seg.charAt(0).toUpperCase() + seg.slice(1) : "Agency view";
}

export function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const unread = activityEvents.filter((e) => e.unread).length;

  // Persist the "selected client" the user was viewing on the agency side.
  // Falls back to the first client so the link is always meaningful.
  const [returnPath, setReturnPath] = useState<string>("/");
  const [returnLabel, setReturnLabel] = useState<string>("Dashboard");

  useEffect(() => {
    const lastPath = getAgencyLastPath();
    let selectedId = getSelectedClientId();
    if (!selectedId && clients.length) {
      selectedId = clients[0].id;
      setSelectedClientId(selectedId);
    }
    // Prefer the last agency page; if none recorded yet, deep-link to the selected client.
    const target = lastPath && lastPath !== "/" && lastPath !== "/dashboard"
      ? lastPath
      : selectedId ? `/clients/${selectedId}` : "/dashboard";
    setReturnPath(target);
    setReturnLabel(describeAgencyPath(target));
  }, [pathname]);

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar sticky top-0 h-screen self-start">
        <div className="h-16 flex items-center gap-3 px-5 border-b border-sidebar-border">
          <div className="size-9 rounded-lg grid place-items-center text-sm font-bold text-primary-foreground shadow-sm" style={{ background: clientCompany.color }}>
            {clientCompany.initials}
          </div>
          <div className="leading-tight min-w-0">
            <div className="font-semibold tracking-tight truncate">{clientCompany.name}</div>
            <div className="text-[11px] text-muted-foreground truncate">Client Portal</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <div className="px-2 pb-2 text-[11px] uppercase tracking-wider text-muted-foreground">Workspace</div>
          {nav.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to}
                className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60")}>
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <div className="rounded-lg bg-card border border-border p-3">
            <div className="text-xs font-medium">Your recruitment partner</div>
            <div className="text-[11px] text-muted-foreground mt-1">TalentFlow · Aarav Reddy</div>
            <div className="text-[11px] text-muted-foreground">aarav@talentflow.in</div>
          </div>
          <button
            type="button"
            // returnPath is a runtime string (last visited agency route); cast to bypass route literal typing.
            onClick={() => navigate({ to: returnPath as never })}
            className="mt-3 w-full flex items-center gap-2 rounded-md px-2 py-2 text-[11px] text-left text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground transition group"
            title={`Return to ${returnPath}`}
          >
            <ArrowLeft className="size-3.5 shrink-0 group-hover:-translate-x-0.5 transition" />
            <span className="leading-tight min-w-0">
              <span className="block font-medium text-foreground/80">Switch to Agency view</span>
              <span className="block truncate text-muted-foreground">Resume · {returnLabel}</span>
            </span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 sticky top-0 z-20 backdrop-blur bg-background/80 border-b border-border flex items-center gap-3 px-4 md:px-8">
          <div className="md:hidden size-9 rounded-lg grid place-items-center text-sm font-bold text-primary-foreground" style={{ background: clientCompany.color }}>
            {clientCompany.initials}
          </div>
          <div className="hidden md:flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input placeholder="Search positions, candidates..." className="w-full h-10 rounded-lg border border-input bg-secondary/50 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/40 focus:bg-background" />
            </div>
          </div>
          <div className="flex-1 md:hidden" />
          <Link to="/client/upload" className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
            <Upload className="size-4" /> Upload JD
          </Link>
          <div className="flex-1" />
          <DropdownMenu>
            <DropdownMenuTrigger className="relative size-9 grid place-items-center rounded-md hover:bg-secondary outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <Bell className="size-4" />
              {unread > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground grid place-items-center">
                  {unread}
                </span>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Notifications</span>
                <Link to="/client/activity" className="text-[11px] text-primary font-medium">View all</Link>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="max-h-80 overflow-y-auto">
                {activityEvents.slice(0, 6).map((e) => (
                  <div key={e.id} className="px-3 py-2.5 border-b border-border last:border-0 hover:bg-secondary/50">
                    <div className="flex items-start gap-2">
                      {e.unread && <span className="mt-1.5 size-1.5 rounded-full bg-primary shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium truncate">{e.title}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{e.detail}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{e.timeAgo}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 pl-2 ml-1 border-l border-border outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-md">
              <div className="size-8 rounded-full bg-gradient-to-br from-info to-purple text-primary-foreground grid place-items-center text-xs font-semibold">VS</div>
              <div className="hidden sm:block text-xs leading-tight text-left">
                <div className="font-medium">Vikram Shah</div>
                <div className="text-muted-foreground">Head of Talent</div>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="text-sm font-medium">Vikram Shah</div>
                <div className="text-[11px] text-muted-foreground font-normal">Head of Talent</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer">
                <Settings className="size-4 mr-2" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/" className="flex items-center gap-2 cursor-pointer">
                  <LogOut className="size-4" /> Sign Out
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 px-4 md:px-8 py-6 md:py-8 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}

export function ClientStatusBadge({ status }: { status: "open" | "in_progress" | "interviews" | "closed" }) {
  const map = {
    open: { c: "bg-warning/15 text-warning border-warning/25", l: "Open" },
    in_progress: { c: "bg-info/15 text-info border-info/25", l: "In Progress" },
    interviews: { c: "bg-purple/15 text-purple border-purple/25", l: "Interviews" },
    closed: { c: "bg-success/15 text-success border-success/25", l: "Closed" },
  };
  const v = map[status];
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border", v.c)}>{v.l}</span>;
}