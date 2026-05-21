import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MapPin, Calendar, Users, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { PriorityBadge, StatusBadge } from "@/components/ui-bits";
import { getPositionById } from "@/lib/positions.functions";
import { daysSince } from "@/lib/display";

export const Route = createFileRoute("/positions/$positionId")({
  component: () => <AppShell><PositionDetail /></AppShell>,
});

function PositionDetail() {
  const { positionId } = Route.useParams();
  const fetchPosition = useServerFn(getPositionById);
  const { data: position, isLoading } = useQuery({
    queryKey: ["position", positionId],
    queryFn: () => fetchPosition({ data: { id: positionId } }),
  });

  if (isLoading) {
    return (
      <div className="p-10 text-center text-sm text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
        <Loader2 className="size-4 animate-spin" /> Loading position…
      </div>
    );
  }
  if (!position) {
    return (
      <div className="space-y-4">
        <Link to="/positions" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> All positions
        </Link>
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Position not found.
        </div>
      </div>
    );
  }

  const client = position.client;
  const days = daysSince(position.posted_at) ?? 0;

  return (
    <div className="space-y-6">
      {client ? (
        <Link to="/clients/$clientId" params={{ clientId: client.id }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {client.name}
        </Link>
      ) : (
        <Link to="/positions" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> All positions
        </Link>
      )}

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">{position.title}</h1>
              <PriorityBadge priority={position.priority} />
              <StatusBadge status={position.status} />
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-3">
              {position.location && <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" /> {position.location}</span>}
              <span className="inline-flex items-center gap-1.5"><Calendar className="size-3.5" /> Posted {days === 0 ? "today" : `${days}d ago`}</span>
              <span className="inline-flex items-center gap-1.5"><Users className="size-3.5" /> {position.openings} opening{position.openings>1?"s":""}</span>
              {(position.experience || position.salary) && <span>{[position.experience, position.salary].filter(Boolean).join(" · ")}</span>}
            </div>
            {position.description && (
              <p className="text-sm text-foreground/80 mt-4 max-w-3xl leading-relaxed whitespace-pre-wrap">{position.description}</p>
            )}
            {position.skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {position.skills.map((s) => (
                  <span key={s} className="text-xs px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground font-medium">{s}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
        <h3 className="font-semibold tracking-tight">Candidate pipeline</h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
          The candidate pipeline, AI scout, and resume review will be wired to the database in Phase 2 (Candidates & Pipeline).
        </p>
      </div>
    </div>
  );
}
