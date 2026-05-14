import { createFileRoute } from "@tanstack/react-router";
import { UsersRound, Mail, Phone, Briefcase, Clock, MessageSquare } from "lucide-react";
import { ClientShell } from "@/components/client-shell";
import { accountTeam, clientPositions } from "@/lib/client-data";

export const Route = createFileRoute("/client/team")({
  component: () => <ClientShell><Page /></ClientShell>,
});

function Page() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Your TalentFlow squad</div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1 inline-flex items-center gap-2">
          <UsersRound className="size-5 text-primary" /> Account Team
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Recruiters and sourcers staffed on your account.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {accountTeam.map((r) => {
          const owned = clientPositions.filter((p) => r.ownedRequirementIds.includes(p.id));
          return (
            <div key={r.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start gap-4">
                <div className="size-12 rounded-xl bg-gradient-to-br from-primary to-purple text-primary-foreground grid place-items-center text-sm font-semibold shrink-0">
                  {r.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.role}</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground mt-3">
                    <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
                      <Mail className="size-3.5" />{r.email}
                    </a>
                    <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
                      <Phone className="size-3.5" />{r.phone}
                    </a>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="rounded-md bg-secondary/60 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                    <Clock className="size-3" /> Avg response
                  </div>
                  <div className="text-sm font-semibold text-foreground tabular-nums">{r.responseHrs} hr</div>
                </div>
                <div className="rounded-md bg-secondary/60 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                    <Briefcase className="size-3" /> Owns
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    {owned.length} requirement{owned.length === 1 ? "" : "s"}
                  </div>
                </div>
              </div>

              {owned.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Active requirements</div>
                  <div className="space-y-1.5">
                    {owned.map((p) => (
                      <div key={p.id} className="text-xs flex items-center justify-between gap-2">
                        <span className="truncate">{p.title}</span>
                        <span className="text-muted-foreground">{p.location}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button className="mt-4 w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
                <MessageSquare className="size-4" /> Message {r.name.split(" ")[0]}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}