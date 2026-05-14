import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { positions, clients } from "@/lib/mock-data";
import { detailFor } from "@/lib/ops/store";
import { Database, Search, Sparkles, Briefcase, MapPin, Building2, History } from "lucide-react";

export const Route = createFileRoute("/database")({
  component: () => <AppShell><Page /></AppShell>,
});

function Page() {
  const [q, setQ] = useState("");

  // Treat candidates not "Closed" / "Offered" as searchable database pool
  const pool = useMemo(
    () =>
      positions.flatMap((p) =>
        p.candidates.map((c) => ({
          ...c,
          posTitle: p.title,
          clientName: clients.find((x) => x.id === p.clientId)!.name,
        }))
      ),
    []
  );

  const filtered = pool.filter(
    (c) =>
      !q ||
      c.name.toLowerCase().includes(q.toLowerCase()) ||
      c.role.toLowerCase().includes(q.toLowerCase()) ||
      c.location.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Talent intelligence</div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1 inline-flex items-center gap-2">
          <Database className="size-5 text-primary" /> Candidate database
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Structured pool of every sourced candidate · rejected and skipped profiles return here with full sourcing history.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, role, location…"
            className="w-full h-10 rounded-md border border-input bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} candidates</span>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-secondary/40">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Candidate</th>
                <th className="text-left font-medium px-2 py-2.5">Role / experience</th>
                <th className="text-left font-medium px-2 py-2.5">Location</th>
                <th className="text-left font-medium px-2 py-2.5">Prev org</th>
                <th className="text-right font-medium px-2 py-2.5">AI %</th>
                <th className="text-left font-medium px-4 py-2.5">Sourcing history</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.slice(0, 50).map((c) => {
                const d = detailFor(c);
                return (
                  <tr key={c.id} className="hover:bg-secondary/30 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded-full bg-gradient-to-br from-primary/40 to-purple/40 grid place-items-center text-[11px] font-semibold">
                          {c.initials}
                        </div>
                        <div className="leading-tight">
                          <div className="font-medium">{c.name}</div>
                          <div className="text-[11px] text-muted-foreground">{c.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <div className="text-xs">{c.role}</div>
                      <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><Briefcase className="size-3" />{c.experience}</div>
                    </td>
                    <td className="px-2 py-3 text-xs"><span className="inline-flex items-center gap-1"><MapPin className="size-3 text-muted-foreground" />{c.location}</span></td>
                    <td className="px-2 py-3 text-xs"><span className="inline-flex items-center gap-1"><Building2 className="size-3 text-muted-foreground" />{d.prevOrg}</span></td>
                    <td className="px-2 py-3 text-right">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                        <Sparkles className="size-3" />{d.aiMatch}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                        <History className="size-3" />
                        Sourced for · <span className="text-foreground font-medium">{c.posTitle}</span> ({c.clientName}) · stage <em>{c.stage}</em>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-[11px] text-muted-foreground">
        Showing first 50 candidates from a pool of {pool.length}. Connect Lovable Cloud to persist candidates, track recruiter actions, and search across all sourcing history.
        <Link to="/scout" className="ml-1 text-primary font-medium">Try AI Scout →</Link>
      </div>
    </div>
  );
}