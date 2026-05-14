import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { ClientShell } from "@/components/client-shell";
import { aggregateFunnel, monthlyHires, sourceMix, accountTeam } from "@/lib/client-data";

export const Route = createFileRoute("/client/reports")({
  component: () => <ClientShell><Page /></ClientShell>,
});

function Page() {
  const f = aggregateFunnel();
  const funnelData = [
    { stage: "Sourced",     count: f.sourced },
    { stage: "Shared",      count: f.shared },
    { stage: "Shortlisted", count: f.shortlisted },
    { stage: "Interview",   count: f.interview },
    { stage: "Offered",     count: f.offered },
    { stage: "Joined",      count: f.joined },
  ];
  const conv = f.sourced > 0 ? Math.round((f.joined / f.sourced) * 100) : 0;
  const avgResponse = (accountTeam.reduce((a, r) => a + r.responseHrs, 0) / accountTeam.length).toFixed(1);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Account analytics</div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1 inline-flex items-center gap-2">
          <BarChart3 className="size-5 text-primary" /> Reports
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Funnel conversion, hires and recruiter performance for your account.</p>
      </div>

      <div className="grid sm:grid-cols-4 gap-3">
        <Stat label="Sourced (all time)" value={f.sourced.toString()} />
        <Stat label="Joined" value={f.joined.toString()} />
        <Stat label="Source → join conversion" value={`${conv}%`} />
        <Stat label="Avg recruiter response" value={`${avgResponse} hr`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Funnel conversion">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="stage" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Monthly hires (last 6 months)">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyHires}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="hires" fill="hsl(var(--success, var(--primary)))" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Source-of-hire mix">
          <div className="space-y-2.5">
            {sourceMix.map((s) => (
              <div key={s.source}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span>{s.source}</span>
                  <span className="tabular-nums text-muted-foreground">{s.pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${s.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Recruiter response time">
          <div className="space-y-3">
            {accountTeam.map((r) => (
              <div key={r.id} className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-gradient-to-br from-primary to-purple text-primary-foreground grid place-items-center text-[11px] font-semibold">
                  {r.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{r.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{r.role}</div>
                </div>
                <div className="text-sm font-semibold tabular-nums">{r.responseHrs} hr</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-sm font-semibold mb-3">{title}</div>
      {children}
    </div>
  );
}