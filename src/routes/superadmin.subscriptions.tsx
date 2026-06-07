import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { SuperAdminShell } from "@/components/superadmin-shell";
import { listAgencies } from "@/lib/superadmin.functions";

export const Route = createFileRoute("/superadmin/subscriptions")({
  ssr: false,
  component: SubscriptionsPage,
});

const PLANS = [
  { id: "starter", name: "Starter", price: "$49 / mo", desc: "Up to 3 recruiters, 5 clients, basic AI scout.", features: ["3 recruiters", "5 clients", "10 open jobs", "Email support"] },
  { id: "professional", name: "Professional", price: "$199 / mo", desc: "Growing teams with full AI sourcing.", features: ["15 recruiters", "Unlimited clients", "100 open jobs", "Priority support", "AI Scout (all sources)"] },
  { id: "enterprise", name: "Enterprise", price: "Custom", desc: "Unlimited everything + SSO + SLA.", features: ["Unlimited everything", "SSO / SAML", "Dedicated CSM", "99.9% SLA", "Custom integrations"] },
];

function SubscriptionsPage() {
  const fetchList = useServerFn(listAgencies);
  const { data } = useQuery({ queryKey: ["sa", "agencies"], queryFn: () => fetchList() });

  return (
    <SuperAdminShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Subscription Plans</h1>
          <p className="text-sm text-muted-foreground mt-1">Plans offered to recruitment agencies. Billing is currently manual.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-card p-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{p.name}</div>
              <div className="mt-2 text-2xl font-semibold">{p.price}</div>
              <p className="text-xs text-muted-foreground mt-1">{p.desc}</p>
              <ul className="mt-4 space-y-1.5 text-xs">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-1.5"><Check className="size-3.5 text-emerald-500" /> {f}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border font-medium">Agencies by plan</div>
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="text-left px-4 py-2 font-medium">Agency</th><th className="text-left px-4 py-2 font-medium">Plan</th><th className="text-left px-4 py-2 font-medium">MRR</th><th className="text-left px-4 py-2 font-medium">Status</th><th className="text-right px-4 py-2 font-medium"></th></tr>
            </thead>
            <tbody>
              {(data?.agencies ?? []).map((a) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="px-4 py-2">{a.name}</td>
                  <td className="px-4 py-2 capitalize">{a.plan}</td>
                  <td className="px-4 py-2">${(a.mrr_cents / 100).toLocaleString()}</td>
                  <td className="px-4 py-2 capitalize">{a.status}</td>
                  <td className="px-4 py-2 text-right">
                    <Link to="/superadmin/agencies/$id" params={{ id: a.id }} className="text-xs text-primary hover:underline">Change plan →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </SuperAdminShell>
  );
}