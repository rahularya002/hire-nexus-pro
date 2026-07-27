import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { MapPin, Plus } from "lucide-react";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { PriorityBadge, StatusBadge, RecruitmentModelBadge } from "@/components/ui-bits";
import { useJdAutofill } from "@/hooks/use-jd-autofill";
import { GenerateDescriptionButton } from "@/components/generate-description-button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { listClients } from "@/lib/clients.functions";
import { listPositions, createPosition } from "@/lib/positions.functions";
import { colorFor, initialsOf } from "@/lib/display";
import { ListRowSkeleton } from "@/components/skeletons";
import { formatSalary } from "@/lib/utils";

export const Route = createFileRoute("/positions")({
  component: () => <AppShell><PositionsShell /></AppShell>,
});

function PositionsShell() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return pathname === "/positions" ? <PositionsPage /> : <Outlet />;
}

function PositionsPage() {
  const [open, setOpen] = useState(false);
  const [statusTab, setStatusTab] = useState<"all" | "open" | "in_progress" | "interviews" | "closed">("all");
  const [modelFilter, setModelFilter] = useState<"all" | "agency" | "self" | "hybrid">("all");
  const fetchPositions = useServerFn(listPositions);
  const fetchClients = useServerFn(listClients);
  const { data: positions = [], isLoading } = useQuery({
    queryKey: ["positions"],
    queryFn: () => fetchPositions({ data: {} }),
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => fetchClients(),
  });
  const counts = {
    all: positions.length,
    open: positions.filter((p) => p.status === "open").length,
    in_progress: positions.filter((p) => p.status === "in_progress").length,
    interviews: positions.filter((p) => p.status === "interviews").length,
    closed: positions.filter((p) => p.status === "closed").length,
  };
  const activeCount = positions.filter((p) => p.status !== "closed").length;
  const filtered = positions.filter((p) =>
    (statusTab === "all" || p.status === statusTab) &&
    (modelFilter === "all" || p.recruitment_model === modelFilter),
  );
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Open requirements</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {activeCount} active · {counts.open} pending pickup · across {clients.length} client{clients.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          disabled={clients.length === 0}
          title={clients.length === 0 ? "Add a client first" : ""}
          className="h-9 inline-flex items-center gap-1.5 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Plus className="size-4" /> New position
        </button>
      </div>

      <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-secondary/60 w-fit">
        {([
          { id: "all",         label: `All (${counts.all})` },
          { id: "open",        label: `Pending (${counts.open})` },
          { id: "in_progress", label: `In progress (${counts.in_progress})` },
          { id: "interviews",  label: `Interviews (${counts.interviews})` },
          { id: "closed",      label: `Closed (${counts.closed})` },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setStatusTab(t.id)}
            className={
              "px-3 py-1.5 rounded-md text-xs font-medium transition " +
              (statusTab === t.id
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Recruitment model:</span>
        <select
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value as typeof modelFilter)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="all">All</option>
          <option value="agency">Agency</option>
          <option value="self">Self</option>
          <option value="hybrid">Hybrid</option>
        </select>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border bg-secondary/30">
          <div className="col-span-5">Position</div>
          <div className="col-span-3">Client</div>
          <div className="col-span-2">Salary</div>
          <div className="col-span-2">Status</div>
        </div>
        <div className="divide-y divide-border">
          {isLoading && <ListRowSkeleton rows={5} />}
          {!isLoading && filtered.length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">
              {clients.length === 0
                ? "Add a client first, then create positions for them."
                : positions.length === 0
                  ? "No positions yet. Click \"New position\" to add one."
                  : `No positions in the "${statusTab}" view.`}
            </div>
          )}
          {!isLoading && filtered.map((p) => {
            const c = p.client;
            return (
              <Link key={p.id} to="/positions/$positionId" params={{ positionId: p.id }}
                className="grid grid-cols-1 md:grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-secondary/40 transition">
                <div className="md:col-span-5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-medium truncate">{p.title}</div>
                    <PriorityBadge priority={p.priority} />
                    <RecruitmentModelBadge model={p.recruitment_model} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
                    <MapPin className="size-3" /> {[p.location, p.experience].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                <div className="md:col-span-3 flex items-center gap-2 min-w-0">
                  {c && (
                    <>
                      <div className="size-7 rounded-md grid place-items-center text-[10px] font-bold text-primary-foreground shrink-0" style={{background: colorFor(c.id, c.color)}}>{initialsOf(c.name)}</div>
                      <div className="text-sm truncate">{c.name}</div>
                    </>
                  )}
                </div>
                <div className="md:col-span-2 text-sm tabular-nums text-muted-foreground">{formatSalary(p.salary)}</div>
                <div className="md:col-span-2"><StatusBadge status={p.status} /></div>
              </Link>
            );
          })}
        </div>
      </div>

      <NewPositionDialog open={open} onOpenChange={setOpen} clients={clients} />
    </div>
  );
}

function NewPositionDialog({ open, onOpenChange, clients }: { open: boolean; onOpenChange: (v: boolean) => void; clients: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createPosition);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [location, setLocation] = useState("");
  const [experience, setExperience] = useState("");
  const [salary, setSalary] = useState("");
  const [openings, setOpenings] = useState(1);
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [skills, setSkills] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const jd = useJdAutofill({
    title,
    description,
    setDescription,
    context: {
      companyName: clients.find((c) => c.id === clientId)?.name ?? null,
      location,
      experience,
      salary,
      skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) { toast.error("Select a client"); return; }
    setSubmitting(true);
    try {
      await createFn({
        data: {
          title: title.trim(),
          client_id: clientId,
          location: location.trim() || undefined,
          experience: experience.trim() || undefined,
          salary: salary.trim() || undefined,
          openings,
          priority,
          description: description.trim() || undefined,
          skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
        },
      });
      toast.success("Position created");
      qc.invalidateQueries({ queryKey: ["positions"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      setTitle(""); setClientId(""); setLocation(""); setExperience(""); setSalary(""); setSkills(""); setDescription(""); setOpenings(1); setPriority("medium");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create position");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New position</DialogTitle>
          <DialogDescription>Create a new open requirement.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1.5"><Label>Title</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} onBlur={jd.onTitleBlur} placeholder="Senior Frontend Engineer" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Client</Label>
              <select required value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Select client…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Bengaluru" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Experience</Label><Input value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="5-8 yrs" /></div>
            <div className="space-y-1.5"><Label>Salary</Label><Input value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="₹30-40 LPA" /></div>
            <div className="space-y-1.5"><Label>Openings</Label><NumberInput min={1} value={openings} onChange={(v) => setOpenings(Math.max(1, Number(v) || 1))} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as any)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="space-y-1.5"><Label>Skills (comma-separated)</Label><Input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="React, TypeScript, Design Systems" /></div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label>Description</Label>
              <GenerateDescriptionButton onClick={jd.generate} loading={jd.generating} hasDescription={!!description.trim()} />
            </div>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What the role entails…" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? "Creating…" : "Create position"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}