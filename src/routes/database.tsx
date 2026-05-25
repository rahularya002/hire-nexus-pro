import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Database, Search, Briefcase, MapPin, Building2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import {
  createCandidate,
  listCandidates,
  type CandidateRow,
} from "@/lib/candidates.functions";
import { initialsOf } from "@/lib/display";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/database")({
  component: () => <AppShell><Page /></AppShell>,
});

function Page() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const fetchCandidates = useServerFn(listCandidates);
  const addCandidate = useServerFn(createCandidate);
  const qc = useQueryClient();
  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ["candidates"],
    queryFn: () => fetchCandidates(),
  });

  const create = useMutation({
    mutationFn: (data: { name: string; email?: string; role?: string; location?: string; experience?: string; current_company?: string }) =>
      addCandidate({ data }),
    onSuccess: () => {
      toast.success("Candidate added");
      qc.invalidateQueries({ queryKey: ["candidates"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const needle = q.toLowerCase().trim();
    if (!needle) return candidates;
    return candidates.filter((c) =>
      [c.name, c.role, c.location, c.email, c.current_company]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(needle)),
    );
  }, [candidates, q]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Talent intelligence</div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1 inline-flex items-center gap-2">
            <Database className="size-5 text-primary" /> Candidate database
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Structured pool of every sourced candidate, persisted in your backend.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="size-4" /> Add candidate</Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, role, company, location, email…"
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
                <th className="text-left font-medium px-2 py-2.5">Current company</th>
                <th className="text-left font-medium px-2 py-2.5">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <TableRowsSkeleton rows={6} cols={5} />
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-xs">
                  No candidates yet. Click "Add candidate" to seed your pool.
                </td></tr>
              )}
              {filtered.map((c: CandidateRow) => (
                <tr key={c.id} className="hover:bg-secondary/30 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-full bg-gradient-to-br from-primary/40 to-purple/40 grid place-items-center text-[11px] font-semibold">
                        {initialsOf(c.name)}
                      </div>
                      <div className="leading-tight">
                        <div className="font-medium">{c.name}</div>
                        <div className="text-[11px] text-muted-foreground">{c.email ?? "—"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <div className="text-xs">{c.role ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                      <Briefcase className="size-3" />{c.experience ?? "—"}
                    </div>
                  </td>
                  <td className="px-2 py-3 text-xs">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3 text-muted-foreground" />{c.location ?? "—"}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-xs">
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="size-3 text-muted-foreground" />{c.current_company ?? "—"}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-xs capitalize">{c.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AddCandidateDialog
        open={open}
        onOpenChange={setOpen}
        onSubmit={(d) => create.mutate(d)}
        submitting={create.isPending}
      />
    </div>
  );
}

function AddCandidateDialog({
  open,
  onOpenChange,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (d: { name: string; email?: string; role?: string; location?: string; experience?: string; current_company?: string }) => void;
  submitting: boolean;
}) {
  const [form, setForm] = useState({ name: "", email: "", role: "", location: "", experience: "", current_company: "" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add candidate</DialogTitle>
          <DialogDescription>Add a new candidate to your talent database.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <Field label="Name *"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Current role"><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Location"><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
            <Field label="Experience"><Input value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })} placeholder="e.g. 7 yrs" /></Field>
          </div>
          <Field label="Current company"><Input value={form.current_company} onChange={(e) => setForm({ ...form, current_company: e.target.value })} /></Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={submitting || !form.name.trim()}
            onClick={() => onSubmit({
              name: form.name.trim(),
              email: form.email.trim() || undefined,
              role: form.role.trim() || undefined,
              location: form.location.trim() || undefined,
              experience: form.experience.trim() || undefined,
              current_company: form.current_company.trim() || undefined,
            })}
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : "Add candidate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}