import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, MapPin, Calendar, Users, ChevronDown, ChevronRight, Building2, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Avatar, PriorityBadge, StatusBadge } from "@/components/ui-bits";
import { getClient, positionsByClient, type ClientAgencyEngagement } from "@/lib/mock-data";

export const Route = createFileRoute("/clients/$clientId")({
  component: () => (
    <AppShell>
      <ClientDetail />
    </AppShell>
  ),
});

function ClientDetail() {
  const { clientId } = Route.useParams();
  const client = getClient(clientId);
  if (!client) throw notFound();
  const list = positionsByClient(clientId);

  return (
    <div className="space-y-6">
      <Link to="/admin/clients" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All clients
      </Link>

      <div className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-secondary/40 p-6 flex items-start gap-5">
        <div className="size-16 rounded-xl grid place-items-center text-xl font-bold text-primary-foreground shadow"
          style={{ background: client.color }}>
          {client.initials}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{client.industry} · SPOC: {client.contact}</p>
          <div className="flex gap-6 mt-4 text-sm">
            <div><span className="font-semibold tabular-nums">{client.openPositions}</span> <span className="text-muted-foreground">open positions</span></div>
            <div><span className="font-semibold tabular-nums">{client.activeCandidates}</span> <span className="text-muted-foreground">active candidates</span></div>
            <div><span className="font-semibold tabular-nums">3</span> <span className="text-muted-foreground">placements MTD</span></div>
            <div><span className="font-semibold tabular-nums">{client.agencies.length}</span> <span className="text-muted-foreground">agencies engaged</span></div>
          </div>
        </div>
      </div>

      {client.agencies.length > 0 && (
        <div>
          <div className="flex items-end justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Agencies engaged</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Click any agency to see the positions {client.name} has given them.</p>
            </div>
          </div>
          <div className="grid gap-3">
            {client.agencies.map((a) => (
              <AgencyCard key={a.id} agency={a} />
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold tracking-tight mb-4">Open positions</h2>
        <div className="grid gap-3">
          {list.map((p) => (
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
                    <span className="inline-flex items-center gap-1"><MapPin className="size-3" /> {p.location}</span>
                    <span className="inline-flex items-center gap-1"><Calendar className="size-3" /> Posted {p.postedDays}d ago</span>
                    <span className="inline-flex items-center gap-1"><Users className="size-3" /> {p.openings} opening{p.openings>1?"s":""}</span>
                    <span>{p.experience} · {p.salary}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {p.skills.map(s => (
                      <span key={s} className="text-[11px] px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground">{s}</span>
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="flex -space-x-2">
                    {p.candidates.slice(0, 4).map(c => (
                      <div key={c.id} className="size-8 rounded-full border-2 border-card bg-gradient-to-br from-primary to-purple text-primary-foreground text-[10px] font-semibold grid place-items-center">
                        {c.initials}
                      </div>
                    ))}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1.5">{p.candidates.length} candidates</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}