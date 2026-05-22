import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { UsersRound, Mail, Briefcase, MessageSquare, Loader2 } from "lucide-react";
import { ClientShell } from "@/components/client-shell";
import { getClientAccountTeam } from "@/lib/team.functions";

export const Route = createFileRoute("/client/team")({
  component: () => <ClientShell><Page /></ClientShell>,
});

function Page() {
  const fetchTeam = useServerFn(getClientAccountTeam);
  const { data, isLoading } = useQuery({ queryKey: ["client-account-team"], queryFn: () => fetchTeam() });
  const members = data?.members ?? [];

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Your TalentFlow squad</div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1 inline-flex items-center gap-2">
          <UsersRound className="size-5 text-primary" /> Account Team
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Recruiters and sourcers staffed on your account.</p>
      </div>

      {isLoading && (
        <div className="rounded-xl border border-border bg-card p-8 inline-flex items-center gap-2 justify-center text-sm text-muted-foreground w-full">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      )}

      {!isLoading && members.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
          No recruiter has been assigned to your positions yet.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {members.map((r) => (
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
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 mt-4">
                <div className="rounded-md bg-secondary/60 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                    <Briefcase className="size-3" /> Owns
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    {r.owned.length} requirement{r.owned.length === 1 ? "" : "s"}
                  </div>
                </div>
              </div>

              {r.owned.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Active requirements</div>
                  <div className="space-y-1.5">
                    {r.owned.map((p) => (
                      <Link key={p.id} to="/client/positions/$positionId" params={{ positionId: p.id }} className="text-xs flex items-center justify-between gap-2 hover:text-primary">
                        <span className="truncate">{p.title}</span>
                        <span className="text-muted-foreground">{p.location ?? "—"}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <Link to="/client/messages" className="mt-4 w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
                <MessageSquare className="size-4" /> Message {r.name.split(" ")[0]}
              </Link>
            </div>
        ))}
      </div>
    </div>
  );
}