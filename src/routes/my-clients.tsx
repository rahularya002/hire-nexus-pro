import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listClients } from "@/lib/clients.functions";
import { listPositions } from "@/lib/positions.functions";
import { colorFor, initialsOf } from "@/lib/display";
import { Building2, Briefcase, ChevronRight, Mail, Phone, User } from "lucide-react";
import { ListRowSkeleton } from "@/components/skeletons";

export const Route = createFileRoute("/my-clients")({
  component: MyClientsPage,
});

function MyClientsPage() {
  const fetchClients = useServerFn(listClients);
  const fetchPositions = useServerFn(listPositions);

  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ["my-clients"],
    queryFn: () => fetchClients(),
  });

  const { data: positions = [], isLoading: positionsLoading } = useQuery({
    queryKey: ["positions"],
    queryFn: () => fetchPositions({ data: {} }),
  });

  const isLoading = clientsLoading || positionsLoading;

  const clientPositionCounts = new Map<string, { open: number; closed: number; total: number }>();
  for (const p of positions) {
    const existing = clientPositionCounts.get(p.client_id) ?? { open: 0, closed: 0, total: 0 };
    existing.total += 1;
    if (p.status === "closed") existing.closed += 1;
    else existing.open += 1;
    clientPositionCounts.set(p.client_id, existing);
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Clients</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {clients.length} client{clients.length === 1 ? "" : "s"} assigned to you
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border bg-secondary/30">
            <div className="col-span-4">Client</div>
            <div className="col-span-3">Contact</div>
            <div className="col-span-3">Positions</div>
            <div className="col-span-2">Status</div>
          </div>
          <div className="divide-y divide-border">
            {isLoading && <ListRowSkeleton rows={4} />}
            {!isLoading && clients.length === 0 && (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No clients assigned yet. You will see clients here once positions are assigned to you.
              </div>
            )}
            {!isLoading && clients.map((c) => {
              const counts = clientPositionCounts.get(c.id) ?? { open: 0, closed: 0, total: 0 };
              return (
                <Link
                  key={c.id}
                  to="/clients/$clientId"
                  params={{ clientId: c.id }}
                  className="grid grid-cols-1 md:grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-secondary/40 transition"
                >
                  <div className="md:col-span-4 flex items-center gap-3 min-w-0">
                    <div
                      className="size-9 rounded-md grid place-items-center text-[10px] font-bold text-primary-foreground shrink-0"
                      style={{ background: colorFor(c.id, c.color) }}
                    >
                      {initialsOf(c.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{c.industry || "—"}</div>
                    </div>
                  </div>

                  <div className="md:col-span-3 min-w-0">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <User className="size-3 shrink-0" />
                      <span className="truncate">{c.contact_name || "—"}</span>
                    </div>
                    {c.contact_email && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        <Mail className="size-3 shrink-0" />
                        <span className="truncate">{c.contact_email}</span>
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-3">
                    <div className="flex items-center gap-2">
                      <Briefcase className="size-3.5 text-muted-foreground" />
                      <span className="text-sm">{counts.total} total</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {counts.open} open · {counts.closed} closed
                    </div>
                  </div>

                  <div className="md:col-span-2 flex items-center justify-between">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        c.status === "active"
                          ? "bg-success/10 text-success"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {c.status === "active" ? "Active" : "Inactive"}
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
