import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronRight, MapPin, Eye, Send, Sparkles, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PriorityBadge, StatusBadge } from "@/components/ui-bits";
import { listPositions } from "@/lib/positions.functions";
import { listApplications, updateApplicationStage, type ApplicationRow } from "@/lib/candidates.functions";
import { colorFor, initialsOf } from "@/lib/display";
import { ListRowSkeleton } from "@/components/skeletons";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ongoing")({
  component: () => <AppShell><Page /></AppShell>,
});

// Stages where the candidate is in the recruiter's pre-share bucket
const PRE_SHARE_STAGES = ["sourcing", "recruiter_shortlist"] as const;
// All stages we want to surface in the Ongoing scout panel (pre-share + already shared)
const VISIBLE_STAGES = [
  "sourcing",
  "recruiter_shortlist",
  "shared_with_client",
  "client_shortlist",
] as const;

function Page() {
  const fetchPositions = useServerFn(listPositions);
  const fetchApps = useServerFn(listApplications);
  const qc = useQueryClient();

  const { data: positions = [], isLoading } = useQuery({
    queryKey: ["positions"],
    queryFn: () => fetchPositions({ data: {} }),
  });
  const { data: apps = [] } = useQuery({
    queryKey: ["applications"],
    queryFn: () => fetchApps({ data: {} }),
  });

  const list = positions.filter((p) => p.status === "in_progress" || p.status === "interviews");
  const appsByPos = (pid: string) => apps.filter((a) => a.position_id === pid);
  const scoutAppsByPos = (pid: string) =>
    apps.filter(
      (a) =>
        a.position_id === pid &&
        VISIBLE_STAGES.includes(a.stage as typeof VISIBLE_STAGES[number]),
    );
  const pendingCountByPos = (pid: string) =>
    apps.filter(
      (a) =>
        a.position_id === pid &&
        PRE_SHARE_STAGES.includes(a.stage as typeof PRE_SHARE_STAGES[number]),
    ).length;

  // Group by client
  const grouped = list.reduce<Record<string, { client: typeof list[number]["client"]; positions: typeof list }>>((acc, p) => {
    const key = p.client?.id ?? "unassigned";
    if (!acc[key]) acc[key] = { client: p.client, positions: [] };
    acc[key].positions.push(p);
    return acc;
  }, {});

  const updateStage = useServerFn(updateApplicationStage);
  const shareMut = useMutation({
    mutationFn: (id: string) => updateStage({ data: { id, stage: "shared_with_client" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["applications"] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ongoing mandates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isLoading ? "\u00A0" : `${list.length} positions across ${Object.keys(grouped).length} client${Object.keys(grouped).length === 1 ? "" : "s"}`}
        </p>
      </div>

      {isLoading && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <ListRowSkeleton rows={4} />
        </div>
      )}

      {!isLoading && list.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-10 text-center text-sm text-muted-foreground">
          No ongoing mandates yet.
        </div>
      )}

      <div className="space-y-8">
        {Object.entries(grouped).map(([key, { client, positions: clientPositions }]) => (
          <section key={key} className="space-y-3">
            <div className="flex items-center gap-3">
              <div
                className="size-9 rounded-lg grid place-items-center text-xs font-bold text-primary-foreground"
                style={{ background: colorFor(client?.id, client?.color) }}
              >
                {initialsOf(client?.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{client?.name ?? "Unassigned"}</div>
                <div className="text-xs text-muted-foreground">
                  {clientPositions.length} position{clientPositions.length === 1 ? "" : "s"}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
              {clientPositions.map((p) => (
                <PositionRow
                  key={p.id}
                  position={p}
                  totalCount={appsByPos(p.id).length}
                  scoutCandidates={scoutAppsByPos(p.id)}
                  pendingCount={pendingCountByPos(p.id)}
                  onShare={(appId) => shareMut.mutate(appId)}
                  sharing={shareMut.isPending}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function PositionRow({
  position,
  totalCount,
  scoutCandidates,
  pendingCount,
  onShare,
  sharing,
}: {
  position: { id: string; title: string; location: string | null; priority: any; status: any };
  totalCount: number;
  scoutCandidates: ApplicationRow[];
  pendingCount: number;
  onShare: (appId: string) => void;
  sharing: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full p-4 flex items-center gap-4 hover:bg-secondary/40 transition text-left"
      >
        <ChevronRight className={cn("size-4 text-muted-foreground transition-transform shrink-0", open && "rotate-90")} />
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{position.title}</div>
          <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5 mt-0.5">
            <MapPin className="size-3" /> {position.location ?? "—"}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {pendingCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              <Sparkles className="size-3" /> {pendingCount} pending review
            </span>
          )}
          <PriorityBadge priority={position.priority} />
          <StatusBadge status={position.status} />
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1 tabular-nums">
            <Users className="size-3" /> {totalCount}
          </span>
        </div>
      </button>

      {open && (
        <div className="bg-secondary/20 border-t border-border px-4 py-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Scout candidates · {pendingCount} pending · {scoutCandidates.length - pendingCount} shared
            </div>
            <Link
              to="/positions/$positionId"
              params={{ positionId: position.id }}
              className="text-xs font-medium text-primary hover:underline"
            >
              Open full position →
            </Link>
          </div>

          {scoutCandidates.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card/40 p-6 text-center text-xs text-muted-foreground">
              No candidates in the recruiter shortlist yet.{" "}
              <Link to="/scout" search={{ positionId: position.id }} className="text-primary hover:underline font-medium">
                Source via AI Talent Scout →
              </Link>
            </div>
          ) : (
            <div className="grid gap-2">
              {scoutCandidates.map((a) => (
                <CandidateRow key={a.id} app={a} onShare={() => onShare(a.id)} sharing={sharing} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CandidateRow({ app, onShare, sharing }: { app: ApplicationRow; onShare: () => void; sharing: boolean }) {
  const c = app.candidate;
  if (!c) return null;
  const initials = (c.name.match(/\b\w/g) ?? ["?"]).slice(0, 2).join("").toUpperCase();
  const alreadyShared = app.stage !== "sourcing" && app.stage !== "recruiter_shortlist";
  return (
    <div className="rounded-lg border border-border bg-card p-3 flex items-start gap-3">
      <div className="size-9 shrink-0 rounded-full bg-gradient-to-br from-primary to-purple text-primary-foreground grid place-items-center text-xs font-semibold">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="font-medium text-sm truncate">{c.name}</div>
          {app.match_score != null && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-success/15 text-success font-semibold tabular-nums">
              {app.match_score}% match
            </span>
          )}
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground uppercase tracking-wide">
            {c.source}
          </span>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 truncate">
          {[c.role, c.current_company, c.location, c.experience].filter(Boolean).join(" · ") || "—"}
        </div>
        {c.skills && c.skills.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {c.skills.slice(0, 6).map((s) => (
              <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-foreground/80">{s}</span>
            ))}
            {c.skills.length > 6 && (
              <span className="text-[10px] px-1.5 py-0.5 text-muted-foreground">+{c.skills.length - 6}</span>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-col sm:flex-row gap-1.5 shrink-0">
        {c.resume_url ? (
          <a
            href={c.resume_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-border bg-card text-xs font-medium hover:bg-secondary"
          >
            <Eye className="size-3.5" /> CV
          </a>
        ) : (
          <span className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-dashed border-border text-xs text-muted-foreground">
            No CV
          </span>
        )}
        <button
          type="button"
          onClick={onShare}
          disabled={sharing || alreadyShared}
          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          <Send className="size-3.5" /> {alreadyShared ? "Shared" : "Share with client"}
        </button>
      </div>
    </div>
  );
}