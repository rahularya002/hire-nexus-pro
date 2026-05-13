import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Avatar } from "@/components/ui-bits";
import { clients } from "@/lib/mock-data";

export const Route = createFileRoute("/clients")({
  component: () => (
    <AppShell>
      <ClientsPage />
    </AppShell>
  ),
});

function ClientsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Active clients</h1>
          <p className="text-sm text-muted-foreground mt-1">{clients.length} clients · {clients.reduce((a, c) => a + c.openPositions, 0)} open positions</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input placeholder="Search clients" className="h-9 w-64 rounded-md border border-input bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/40" />
          </div>
          <button className="h-9 inline-flex items-center gap-1.5 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium">
            <Plus className="size-4" /> New client
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients.map((c) => (
          <Link key={c.id} to="/clients/$clientId" params={{ clientId: c.id }}
            className="group rounded-xl border border-border bg-card p-5 hover:shadow-md hover:border-primary/30 transition-all">
            <div className="flex items-center gap-3">
              <Avatar initials={c.initials} color={c.color} />
              <div className="min-w-0">
                <div className="font-semibold truncate">{c.name}</div>
                <div className="text-xs text-muted-foreground truncate">{c.industry}</div>
              </div>
              <ArrowUpRight className="ml-auto size-4 text-muted-foreground group-hover:text-primary transition" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-md bg-secondary/60 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Open</div>
                <div className="text-lg font-semibold tabular-nums">{c.openPositions}</div>
              </div>
              <div className="rounded-md bg-secondary/60 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Candidates</div>
                <div className="text-lg font-semibold tabular-nums">{c.activeCandidates}</div>
              </div>
            </div>
            <div className="mt-3 text-[11px] text-muted-foreground">SPOC · {c.contact}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}