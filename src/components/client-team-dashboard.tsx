import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Inbox, CalendarCheck, Briefcase, MessageSquare, Workflow, ArrowUpRight, MapPin } from "lucide-react";
import { ClientStatusBadge } from "@/components/client-shell";
import { listPositions } from "@/lib/positions.functions";
import { listApplications } from "@/lib/candidates.functions";
import { useAuth } from "@/lib/auth/auth-context";
import { CardListSkeleton } from "@/components/skeletons";

export function ClientTeamDashboard() {
  const { profile, clientContext } = useAuth();
  const fetchPositions = useServerFn(listPositions);
  const fetchApps = useServerFn(listApplications);
  const posQ = useQuery({ queryKey: ["client-positions"], queryFn: () => fetchPositions({ data: {} }) });
  const appQ = useQuery({ queryKey: ["client-applications-all"], queryFn: () => fetchApps({ data: {} }) });

  const positions = posQ.data ?? [];
  const apps = appQ.data ?? [];
  const loading = posQ.isLoading || appQ.isLoading;

  const awaitingReview = apps.filter((a) => a.stage === "shared_with_client").length;
  const openPositions = positions.filter((p) => p.status !== "closed").length;

  const interviewsScheduled = apps.filter((a) => a.stage === "interview_scheduled" || a.stage === "rounds").length;

  const firstName = (profile?.full_name || "").split(/\s+/)[0] || "there";
  const company = clientContext?.companyName || profile?.company_name || "your team";

  const kpis = [
    { label: "Awaiting your review", value: awaitingReview, icon: Inbox, tone: "from-primary/15 to-primary/5 text-primary", to: "/client/pipeline" as const },
    { label: "Interviews scheduled", value: interviewsScheduled, icon: CalendarCheck, tone: "from-info/15 to-info/5 text-info", to: "/client/interviews" as const },
    { label: "Open positions", value: openPositions, icon: Briefcase, tone: "from-purple/15 to-purple/5 text-purple", to: "/client/positions" as const },
  ];

  const recent = positions.slice(0, 5);

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-border p-6 md:p-8 bg-gradient-to-br from-info/10 via-purple/5 to-card">
        <div className="absolute -right-20 -top-20 size-64 rounded-full opacity-20 blur-3xl" style={{ background: "oklch(0.62 0.20 245)" }} />
        <div className="relative min-w-0">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{company} · Team workspace</div>
          <h1 className="text-3xl font-semibold tracking-tight mt-2">Hi {firstName}, here's your queue</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">
            {loading
              ? "Loading your queue…"
              : `${awaitingReview} candidate${awaitingReview === 1 ? "" : "s"} need your review, and ${interviewsScheduled} interview${interviewsScheduled === 1 ? "" : "s"} are in motion.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Link key={k.label} to={k.to} className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 hover:shadow-md transition group">
              <div className="flex items-start justify-between">
                <div className={`size-10 rounded-lg grid place-items-center bg-gradient-to-br ${k.tone}`}>
                  <Icon className="size-5" />
                </div>
                <ArrowUpRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
              </div>
              <div className="mt-3 text-3xl font-semibold tabular-nums">{k.value}</div>
              <div className="text-sm text-muted-foreground mt-0.5">{k.label}</div>
            </Link>
          );
        })}
      </div>

      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Recent positions</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Jump into any role to review candidates</p>
          </div>
          <Link to="/client/positions" className="text-sm text-primary font-medium">View all</Link>
        </div>
        <div className="grid gap-3">
          {loading && <CardListSkeleton rows={3} />}
          {!loading && recent.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
              No open positions yet. Your team admin will share roles here.
            </div>
          )}
          {recent.map((p) => (
            <Link key={p.id} to="/client/positions/$positionId" params={{ positionId: p.id }}
              className="group rounded-xl border border-border bg-card p-4 hover:shadow-md hover:border-primary/30 transition">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold group-hover:text-primary transition">{p.title}</h3>
                    <ClientStatusBadge status={p.status} />
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1.5">
                    <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{p.location ?? "—"}</span>
                    <span>{p.openings} opening{p.openings > 1 ? "s" : ""}</span>
                  </div>
                </div>
                <ArrowUpRight className="size-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid sm:grid-cols-2 gap-3">
        <Link to="/client/pipeline" className="rounded-xl border border-border bg-card p-5 flex items-center gap-3 hover:border-primary/30 hover:shadow-md transition">
          <div className="size-10 rounded-lg grid place-items-center bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
            <Workflow className="size-5" />
          </div>
          <div>
            <div className="font-medium">Open the pipeline</div>
            <div className="text-xs text-muted-foreground">Review shortlists and move candidates forward</div>
          </div>
        </Link>
        <Link to="/client/messages" className="rounded-xl border border-border bg-card p-5 flex items-center gap-3 hover:border-primary/30 hover:shadow-md transition">
          <div className="size-10 rounded-lg grid place-items-center bg-gradient-to-br from-info/15 to-info/5 text-info">
            <MessageSquare className="size-5" />
          </div>
          <div>
            <div className="font-medium">Message your recruiter</div>
            <div className="text-xs text-muted-foreground">Ask questions or share feedback in one place</div>
          </div>
        </Link>
      </section>
    </div>
  );
}