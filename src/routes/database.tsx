import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Database, Search, Briefcase, MapPin, Building2, Plus, Loader2, SearchX, CheckCircle2, XCircle, Send, CalendarClock, Trophy, History as HistoryIcon, X, Pencil } from "lucide-react";
import { TableRowsSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import {
  createCandidate,
  listCandidates,
  listApplications,
  STAGE_LABEL,
  type ApplicationRow,
  type ApplicationStage,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { EditCandidateDialog } from "@/components/edit-candidate-dialog";

export const Route = createFileRoute("/database")({
  component: () => <AppShell><Page /></AppShell>,
});

function Page() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<CandidateRow | null>(null);
  const fetchCandidates = useServerFn(listCandidates);
  const addCandidate = useServerFn(createCandidate);
  const qc = useQueryClient();
  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ["candidates"],
    queryFn: () => fetchCandidates(),
  });

  const create = useMutation({
    mutationFn: (data: { name: string; email?: string; phone?: string; role?: string; location?: string; experience?: string; current_company?: string; linkedin_url?: string; salary?: string; skills?: string[] }) =>
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
      [c.name, c.role, c.location, c.email, c.current_company, c.phone, ...(c.skills ?? [])]
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
                <tr><td colSpan={5} className="px-4 py-8">
                  <EmptyState
                    icon={q ? SearchX : Database}
                    title={q ? "No matches found" : "No candidates yet"}
                    description={
                      q
                        ? `Nothing matches "${q}". Try a different name, skill, or company.`
                        : "Click \"Add candidate\" to seed your talent pool."
                    }
                    className="border-0 bg-transparent p-0"
                  />
                </td></tr>
              )}
              {filtered.map((c: CandidateRow) => (
                <tr
                  key={c.id}
                  className="hover:bg-secondary/30 transition cursor-pointer"
                  onClick={() => setSelected(c)}
                >
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
      <CandidateDetailSheet
        candidate={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function CandidateDetailSheet({
  candidate,
  onClose,
}: {
  candidate: CandidateRow | null;
  onClose: () => void;
}) {
  const fetchApps = useServerFn(listApplications);
  const [editing, setEditing] = useState(false);
  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["candidate-history", candidate?.id],
    queryFn: () => fetchApps({ data: { candidateId: candidate!.id } }),
    enabled: !!candidate,
  });

  return (
    <Sheet open={!!candidate} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {candidate && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-gradient-to-br from-primary/40 to-purple/40 grid place-items-center text-sm font-semibold">
                  {initialsOf(candidate.name)}
                </div>
                <div className="leading-tight">
                  <div>{candidate.name}</div>
                  <div className="text-xs font-normal text-muted-foreground">
                    {candidate.role ?? "—"}
                  </div>
                </div>
                <Button size="sm" variant="outline" className="ml-auto gap-1.5" onClick={() => setEditing(true)}>
                  <Pencil className="size-3.5" /> Edit
                </Button>
              </SheetTitle>
              <SheetDescription className="sr-only">Candidate details and history</SheetDescription>
            </SheetHeader>

            <Tabs defaultValue="profile" className="mt-5">
              <TabsList>
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="history" className="gap-1.5">
                  History
                  {apps.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                      {apps.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="profile" className="space-y-2 text-sm">
                <Row k="Email" v={candidate.email} />
                <Row k="Phone" v={candidate.phone} />
                <Row k="Experience" v={candidate.experience} />
                <Row k="Location" v={candidate.location} />
                <Row k="Current company" v={candidate.current_company} />
                <Row k="Skills" v={candidate.skills?.length ? candidate.skills.join(", ") : null} />
                <Row k="Source" v={candidate.source} />
                {candidate.linkedin_url && (
                  <a href={candidate.linkedin_url} target="_blank" rel="noreferrer"
                    className="text-primary text-xs underline">View LinkedIn profile</a>
                )}
              </TabsContent>
              <TabsContent value="history" className="space-y-3">
                {isLoading && <div className="text-xs text-muted-foreground py-6">Loading history…</div>}
                {!isLoading && apps.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center">
                    <HistoryIcon className="size-6 text-muted-foreground mx-auto mb-2" />
                    <div className="text-xs text-muted-foreground">
                      This candidate hasn't been shared with any client yet.
                    </div>
                  </div>
                )}
                {!isLoading && apps.length > 0 && <HistorySummary apps={apps} />}
                <ul className="space-y-2">
                  {[...apps]
                    .sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))
                    .map((a: ApplicationRow) => (
                      <HistoryItem key={a.id} app={a} />
                    ))}
                </ul>
              </TabsContent>
            </Tabs>
            <EditCandidateDialog
              open={editing}
              onOpenChange={setEditing}
              candidate={candidate}
              invalidateKeys={[["candidates"], ["candidate-history", candidate.id]]}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Row({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div className="flex gap-3 py-1">
      <span className="text-xs text-muted-foreground w-32 shrink-0">{k}</span>
      <span className="text-xs">{v ?? "—"}</span>
    </div>
  );
}

const STAGE_META: Partial<Record<ApplicationStage, { tone: string; Icon: typeof Send }>> = {
  shared_with_client:   { tone: "bg-info/15 text-info",          Icon: Send },
  client_shortlist:     { tone: "bg-emerald-500/15 text-emerald-600", Icon: CheckCircle2 },
  client_rejected:      { tone: "bg-destructive/15 text-destructive", Icon: XCircle },
  interview_scheduled:  { tone: "bg-purple/15 text-purple",      Icon: CalendarClock },
  rounds:               { tone: "bg-purple/15 text-purple",      Icon: CalendarClock },
  offered:              { tone: "bg-emerald-500/15 text-emerald-600", Icon: Trophy },
  closed:               { tone: "bg-secondary text-secondary-foreground", Icon: CheckCircle2 },
};

function HistorySummary({ apps }: { apps: ApplicationRow[] }) {
  const clients = new Set(apps.map((a) => a.position?.client?.id).filter(Boolean));
  const shortlisted = apps.filter((a) => ["client_shortlist", "interview_scheduled", "rounds", "offered"].includes(a.stage)).length;
  const rejected = apps.filter((a) => a.stage === "client_rejected").length;
  return (
    <div className="grid grid-cols-3 gap-2">
      <Stat label="Clients" value={clients.size} />
      <Stat label="Shortlisted" value={shortlisted} tone="text-emerald-600" />
      <Stat label="Rejected" value={rejected} tone="text-destructive" />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2">
      <div className={`text-lg font-semibold leading-none ${tone ?? ""}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function HistoryItem({ app: a }: { app: ApplicationRow }) {
  const meta = STAGE_META[a.stage] ?? { tone: "bg-secondary text-secondary-foreground", Icon: Send };
  const Icon = meta.Icon;
  const dot = a.position?.client?.color ?? "hsl(var(--muted-foreground))";
  const rejected = a.stage === "client_rejected";
  const date = new Date(a.updated_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  return (
    <li className="rounded-lg border border-border bg-card p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="size-2 rounded-full shrink-0" style={{ background: dot }} />
          <div className="text-sm font-medium truncate">{a.position?.client?.name ?? "Client"}</div>
        </div>
        <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${meta.tone}`}>
          <Icon className="size-3" />
          {STAGE_LABEL[a.stage] ?? a.stage}
        </span>
      </div>
      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
        <span className="truncate">{a.position?.title ?? "—"}</span>
        {a.match_score != null && <span>· {a.match_score}% match</span>}
        <span>· {date}</span>
      </div>
      {rejected && a.notes && (
        <div className="text-xs text-destructive/90 rounded-md bg-destructive/5 border border-destructive/15 px-2 py-1.5">
          <span className="font-medium">Reason:</span> {a.notes}
        </div>
      )}
    </li>
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