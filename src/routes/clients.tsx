import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Plus, Search } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Avatar } from "@/components/ui-bits";
import { clients, isClientInactive, INACTIVITY_THRESHOLD_DAYS } from "@/lib/mock-data";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/clients")({
  component: () => (
    <AppShell>
      <ClientsPage />
    </AppShell>
  ),
});

function ClientsPage() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const visible = clients.filter((c) => {
    if (filter === "all") return true;
    const inactive = isClientInactive(c);
    return filter === "inactive" ? inactive : !inactive;
  });
  const inactiveCount = clients.filter(isClientInactive).length;
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {clients.length} total · {clients.length - inactiveCount} active · {inactiveCount} inactive
            <span className="ml-2 text-[11px]">(auto-inactive after {INACTIVITY_THRESHOLD_DAYS}d of no activity unless requirements are open)</span>
          </p>
        </div>
        <div className="flex gap-2">
          <div className="inline-flex rounded-md border border-input bg-card overflow-hidden">
            {(["all", "active", "inactive"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`h-9 px-3 text-xs font-medium capitalize ${filter === f ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60"}`}>{f}</button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input placeholder="Search clients" className="h-9 w-64 rounded-md border border-input bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/40" />
          </div>
          <button onClick={() => setOpen(true)} className="h-9 inline-flex items-center gap-1.5 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
            <Plus className="size-4" /> New client
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visible.map((c) => {
          const inactive = isClientInactive(c);
          return (
          <Link key={c.id} to="/clients/$clientId" params={{ clientId: c.id }}
            className={`group rounded-xl border bg-card p-5 hover:shadow-md transition-all ${inactive ? "border-warning/40 opacity-90" : "border-border hover:border-primary/30"}`}>
            <div className="flex items-center gap-3">
              <Avatar initials={c.initials} color={c.color} />
              <div className="min-w-0">
                <div className="font-semibold truncate flex items-center gap-2">
                  {c.name}
                  {inactive && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-warning/15 text-warning">Inactive</span>}
                </div>
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
            <div className="mt-3 text-[11px] text-muted-foreground flex items-center justify-between">
              <span>SPOC · {c.contact}</span>
              <span>{c.lastActivityDays === 0 ? "Active today" : `Last activity ${c.lastActivityDays}d ago`}</span>
            </div>
          </Link>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New client</DialogTitle>
            <DialogDescription>Add a new client to your active roster.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => { e.preventDefault(); toast.success("Client added"); setOpen(false); }}
          >
            <div className="space-y-1.5"><Label>Company name</Label><Input required placeholder="Acme Corp" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Industry</Label><Input required placeholder="FinTech" /></div>
              <div className="space-y-1.5"><Label>SPOC</Label><Input required placeholder="Jane Doe" /></div>
            </div>
            <div className="space-y-1.5"><Label>Email</Label><Input required type="email" placeholder="hr@acme.com" /></div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">Add client</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}