import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Cell } from "recharts";
import { ClientShell } from "@/components/client-shell";
import { getClientReports } from "@/lib/billing.functions";

export const Route = createFileRoute("/client/reports")({
  component: () => <ClientShell><Page /></ClientShell>,
});

function Page() {
  const fn = useServerFn(getClientReports);
  const q = useQuery({ queryKey: ["client", "reports"], queryFn: () => fn() });
  const f = q.data?.funnel ?? { shared: 0, shortlisted: 0, interview: 0, offered: 0, joined: 0 };
  const monthlyHires = q.data?.monthlyHires ?? [];
  const funnelData = [
    { stage: "Shared", count: f.shared },
    { stage: "Shortlisted", count: f.shortlisted },
    { stage: "Interviewed", count: f.interview },
    { stage: "Offered", count: f.offered },
    { stage: "Joined", count: f.joined },
  ];
  const conv = f.shared > 0 ? Math.round((f.joined / f.shared) * 100) : 0;
  const funnelColors = ["var(--purple)", "var(--primary)", "var(--warning)", "var(--chart-1)", "var(--success)"];

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Account analytics</div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1 inline-flex items-center gap-2">
          <BarChart3 className="size-5 text-primary" /> Reports
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Funnel conversion and hires for your account.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Stat label="Profiles shared" value={f.shared.toString()} />
        <Stat label="Joined" value={f.joined.toString()} />
        <Stat label="Share → join conversion" value={`${conv}%`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Funnel conversion">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="stage" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "var(--accent)", opacity: 0.3 }} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--popover-foreground)" }} />
                <Bar dataKey="count" radius={[6,6,0,0]}>
                  {funnelData.map((_, i) => <Cell key={i} fill={funnelColors[i % funnelColors.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Monthly hires (last 6 months)">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyHires}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "var(--accent)", opacity: 0.3 }} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--popover-foreground)" }} />
                <Bar dataKey="hires" fill="var(--primary)" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
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
