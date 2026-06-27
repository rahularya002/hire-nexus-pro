import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MapPin, Calendar, Users, Mail, Phone, Loader2, Building2, UserPlus, Check } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PriorityBadge, StatusBadge } from "@/components/ui-bits";
import { getClientById } from "@/lib/clients.functions";
import { listPositions, listAssignableRecruiters, assignClientRecruiter } from "@/lib/positions.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { colorFor, initialsOf, daysSince } from "@/lib/display";

export const Route = createFileRoute("/clients/$clientId")({
  component: () => (
    <AppShell>
      <ClientDetail />
    </AppShell>
  ),
});

function ClientDetail() {
  const { clientId } = Route.useParams();
  const fetchClient = useServerFn(getClientById);
  const fetchPositions = useServerFn(listPositions);
  const fetchRecruiters = useServerFn(listAssignableRecruiters);
  const assignFn = useServerFn(assignClientRecruiter);
  const qc = useQueryClient();
  const { data: client, isLoading } = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => fetchClient({ data: { id: clientId } }),
  });
  const { data: list = [] } = useQuery({
    queryKey: ["positions", { clientId }],
    queryFn: () => fetchPositions({ data: { clientId } }),
    enabled: !!client,
  });
  const { data: recruiters = [] } = useQuery({
    queryKey: ["assignable-recruiters"],
    queryFn: () => fetchRecruiters(),
  });
  const currentRecruiterId = useMemo(() => {
    const open = list.filter((p) => p.status !== "closed");
    if (open.length === 0) return null;
    const first = open[0].assigned_recruiter_id;
    return open.every((p) => p.assigned_recruiter_id === first) ? first : "__mixed__";
  }, [list]);
  const [selected, setSelected] = useState<string | null>(null);
  const pending = selected !== null && selected !== currentRecruiterId;
  const assignMutation = useMutation({
    mutationFn: (recruiterId: string | null) =>
      assignFn({ data: { clientId, assigned_recruiter_id: recruiterId, onlyOpen: true } }),
    onSuccess: (res) => {
      toast.success(`Assigned recruiter to ${res.count} open position${res.count === 1 ? "" : "s"}`);
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["positions"] });
      qc.invalidateQueries({ queryKey: ["client", clientId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to assign"),
  });

  if (isLoading) {
    return (
      <div className="p-10 text-center text-sm text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
        <Loader2 className="size-4 animate-spin" /> Loading client…
      </div>
    );
  }
  if (!client) {
    return (
      <div className="space-y-4">
        <Link to="/admin/clients" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> All clients
        </Link>
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Client not found.
        </div>
      </div>
    );
  }

  const color = colorFor(client.id, client.color);
  const openPositions = list.filter((p) => p.status !== "closed").length;
  const lastActivity = daysSince(client.last_activity_at ?? client.created_at);

  return (
    <div className="space-y-6">
      <Link to="/admin/clients" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All clients
      </Link>

      <div className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-secondary/40 p-6 flex items-start gap-5">
        <div className="size-16 rounded-xl grid place-items-center text-xl font-bold text-primary-foreground shadow"
          style={{ background: color }}>
          {initialsOf(client.name)}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {[client.industry, client.contact_name && `SPOC: ${client.contact_name}`].filter(Boolean).join(" · ") || "—"}
          </p>
          <div className="flex gap-4 mt-3 text-xs flex-wrap">
            {client.contact_email && (
              <a href={`mailto:${client.contact_email}`} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"><Mail className="size-3.5" /> {client.contact_email}</a>
            )}
            {client.contact_phone && (
              <a href={`tel:${client.contact_phone}`} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"><Phone className="size-3.5" /> {client.contact_phone}</a>
            )}
          </div>
          <div className="flex gap-6 mt-4 text-sm">
            <div><span className="font-semibold tabular-nums">{openPositions}</span> <span className="text-muted-foreground">open positions</span></div>
            <div><span className="font-semibold tabular-nums">{list.length}</span> <span className="text-muted-foreground">positions total</span></div>
            {lastActivity !== null && (
              <div><span className="font-semibold tabular-nums">{lastActivity === 0 ? "Today" : `${lastActivity}d ago`}</span> <span className="text-muted-foreground">last activity</span></div>
            )}
            <div className="inline-flex items-center gap-1.5 text-muted-foreground"><Building2 className="size-3.5" /> {client.status === "active" ? "Active account" : "Inactive"}</div>
          </div>
          {client.notes && (
            <p className="mt-4 text-sm text-foreground/80 rounded-lg bg-secondary/40 p-3 max-w-3xl">{client.notes}</p>
          )}
        </div>
        <div className="hidden md:flex flex-col gap-2 min-w-[240px]">
          <label className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
            <UserPlus className="size-3.5" /> Assigned recruiter
          </label>
          <Select
            value={selected ?? (currentRecruiterId && currentRecruiterId !== "__mixed__" ? currentRecruiterId : "") }
            onValueChange={(v) => setSelected(v === "__none__" ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder={currentRecruiterId === "__mixed__" ? "Mixed across positions" : "Select a recruiter"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Unassigned</SelectItem>
              {recruiters.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.name} <span className="text-muted-foreground">· {r.role.replace("_", " ")}</span></SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={!pending || assignMutation.isPending}
            onClick={() => assignMutation.mutate(selected)}
          >
            {assignMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            Apply to open positions
          </Button>
          <p className="text-[11px] text-muted-foreground">Updates all open requirements for this client.</p>
        </div>
      </div>

      {(client.pan_number || client.gst_number || client.website || client.registered_address) && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold tracking-tight mb-4">Company details</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            {client.website && (
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Website</dt>
                <dd><a href={client.website.startsWith("http") ? client.website : `https://${client.website}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">{client.website}</a></dd>
              </div>
            )}
            {client.pan_number && (
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">PAN</dt>
                <dd className="font-mono">{client.pan_number}</dd>
              </div>
            )}
            {client.gst_number && (
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">GSTIN</dt>
                <dd className="font-mono">{client.gst_number}</dd>
              </div>
            )}
            {client.registered_address && (
              <div className="md:col-span-2">
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Registered address</dt>
                <dd className="whitespace-pre-line">{client.registered_address}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold tracking-tight mb-4">Positions</h2>
        <div className="grid gap-3">
          {list.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
              No positions yet for {client.name}. <Link to="/positions" className="text-primary hover:underline">Create one</Link>.
            </div>
          )}
          {list.map((p) => {
            const days = daysSince(p.posted_at) ?? 0;
            return (
              <Link key={p.id} to="/positions/$positionId" params={{ positionId: p.id }}
                className="rounded-xl border border-border bg-card p-5 hover:shadow-md hover:border-primary/30 transition group">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold group-hover:text-primary transition">{p.title}</h3>
                      <PriorityBadge priority={p.priority} />
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-2">
                      {p.location && <span className="inline-flex items-center gap-1"><MapPin className="size-3" /> {p.location}</span>}
                      <span className="inline-flex items-center gap-1"><Calendar className="size-3" /> Posted {days === 0 ? "today" : `${days}d ago`}</span>
                      <span className="inline-flex items-center gap-1"><Users className="size-3" /> {p.openings} opening{p.openings > 1 ? "s" : ""}</span>
                      {(p.experience || p.salary) && <span>{[p.experience, p.salary].filter(Boolean).join(" · ")}</span>}
                    </div>
                    {p.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {p.skills.map((s) => (
                          <span key={s} className="text-[11px] px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground">{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}