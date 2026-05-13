import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Briefcase, Upload, FileText, Settings, Bell, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { clientCompany } from "@/lib/client-data";

const nav = [
  { to: "/client", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/client/positions", label: "Positions", icon: Briefcase },
  { to: "/client/upload", label: "Upload JD", icon: Upload },
  { to: "/client/documents", label: "Documents", icon: FileText },
];

export function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="h-16 flex items-center gap-3 px-5 border-b border-sidebar-border">
          <div className="size-9 rounded-lg grid place-items-center text-sm font-bold text-primary-foreground shadow-sm" style={{ background: clientCompany.color }}>
            {clientCompany.initials}
          </div>
          <div className="leading-tight min-w-0">
            <div className="font-semibold tracking-tight truncate">{clientCompany.name}</div>
            <div className="text-[11px] text-muted-foreground truncate">Client Portal</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
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
          <Link to="/" className="block text-[11px] text-muted-foreground hover:text-foreground mt-3 px-2">
            ← Switch to Agency view
          </Link>
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
          <button className="relative size-9 grid place-items-center rounded-md hover:bg-secondary">
            <Bell className="size-4" />
            <span className="absolute top-2 right-2 size-1.5 rounded-full bg-destructive" />
          </button>
          <button className="size-9 grid place-items-center rounded-md hover:bg-secondary">
            <Settings className="size-4" />
          </button>
          <div className="flex items-center gap-2 pl-2 ml-1 border-l border-border">
            <div className="size-8 rounded-full bg-gradient-to-br from-info to-purple text-primary-foreground grid place-items-center text-xs font-semibold">VS</div>
            <div className="hidden sm:block text-xs leading-tight">
              <div className="font-medium">Vikram Shah</div>
              <div className="text-muted-foreground">Head of Talent</div>
            </div>
          </div>
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