import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { format } from "date-fns";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import {
  listTasks,
  createTask as createTaskFn,
  moveTaskState,
  deleteTask,
  DEFAULT_TASK_KINDS,
  TASK_STATES,
  type TaskRow,
  type TaskState,
} from "@/lib/tasks.functions";
import { listClients, type ClientRow } from "@/lib/clients.functions";
import { ClipboardList, Plus, Clock, CalendarIcon, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { KanbanCardSkeleton } from "@/components/skeletons";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";

export const Route = createFileRoute("/tasks")({ component: TasksPage });

const COLUMNS: TaskState[] = [...TASK_STATES];

function TasksPage() {
  const qc = useQueryClient();
  const fetchTasks = useServerFn(listTasks);
  const fetchClients = useServerFn(listClients);
  const addTask = useServerFn(createTaskFn);
  const moveTask = useServerFn(moveTaskState);
  const removeTask = useServerFn(deleteTask);

  const { data: tasks = [], isLoading } = useQuery({ queryKey: ["tasks"], queryFn: () => fetchTasks() });
  const { data: clientsList = [] } = useQuery<ClientRow[]>({ queryKey: ["clients"], queryFn: () => fetchClients() });

  const [open, setOpen] = useState(false);
  const [kinds, setKinds] = useState<string[]>([...DEFAULT_TASK_KINDS]);
  const [manageKindsOpen, setManageKindsOpen] = useState(false);
  const [newKind, setNewKind] = useState("");
  const [form, setForm] = useState({
    title: "",
    client_id: "",
    candidate: "",
    kind: DEFAULT_TASK_KINDS[0] as string,
    dueDate: undefined as Date | undefined,
  });

  const moveMut = useMutation({
    mutationFn: (v: { id: string; state: TaskState }) => moveTask({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const createMut = useMutation({
    mutationFn: (data: {
      title: string;
      kind?: string;
      client_id?: string | null;
      notes?: string | null;
      due_at?: string | null;
      due_label?: string | null;
    }) => addTask({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setOpen(false);
      setForm({ title: "", client_id: "", candidate: "", kind: kinds[0] ?? "Call candidate", dueDate: undefined });
      toast.success("Task created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => removeTask({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); toast.success("Task deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const clientById = new Map(clientsList.map((c) => [c.id, c]));

  const move = (id: string, dir: 1 | -1) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    const idx = COLUMNS.indexOf(t.state);
    const next = COLUMNS[Math.min(COLUMNS.length - 1, Math.max(0, idx + dir))];
    if (next === t.state) return;
    moveMut.mutate({ id, state: next });
  };

  const submitCreate = () => {
    if (!form.title) { toast.error("Title is required"); return; }
    const dueLabel = form.dueDate ? format(form.dueDate, "PPP") : null;
    createMut.mutate({
      title: form.title,
      kind: form.kind,
      client_id: form.client_id || null,
      notes: form.candidate ? `Candidate: ${form.candidate}` : null,
      due_at: form.dueDate ? form.dueDate.toISOString() : null,
      due_label: dueLabel,
    });
  };

  const addKind = () => {
    const v = newKind.trim();
    if (!v) return;
    if (kinds.some((k) => k.toLowerCase() === v.toLowerCase())) {
      toast.error("That kind already exists");
      return;
    }
    setKinds((prev) => [...prev, v]);
    setNewKind("");
    toast.success(`Added "${v}"`);
  };

  const removeKind = (k: string) => {
    setKinds((prev) => prev.filter((x) => x !== k));
    if (form.kind === k) setForm((f) => ({ ...f, kind: kinds[0] ?? "" }));
  };

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Recruiter execution</div>
            <h1 className="text-2xl font-semibold tracking-tight mt-1 inline-flex items-center gap-2">
              <ClipboardList className="size-5 text-primary" /> Task board
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Trello-style cockpit for daily recruiter work — move tasks across operational states.</p>
          </div>
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
            <Plus className="size-4" /> New task
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {COLUMNS.map((col) => {
            const items = tasks.filter((t) => t.state === col);
            return (
              <div key={col} className="rounded-xl border border-border bg-card flex flex-col min-h-[400px]">
                <div className="p-3 border-b border-border flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wider">{col}</div>
                  <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{items.length}</span>
                </div>
                <div className="p-2 space-y-2 flex-1">
                  {isLoading && <KanbanCardSkeleton rows={2} />}
                  {!isLoading && items.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">No tasks</div>}
                  {items.map((t: TaskRow) => {
                    const c = t.client_id ? clientById.get(t.client_id) : null;
                    const dueLabel = t.due_label ?? (t.due_at ? format(new Date(t.due_at), "PP") : "No due date");
                    return (
                    <div key={t.id} className="rounded-lg border border-border bg-background/40 p-2.5 hover:border-primary/40 transition group">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{t.kind}</div>
                      <div className="text-sm font-medium leading-snug mt-1">{t.title}</div>
                      {(c || t.notes) && (
                        <div className="text-[11px] text-muted-foreground mt-1 truncate">
                          {c?.name}{c && t.notes && " · "}{t.notes}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-2.5">
                        <span className={cn(
                          "text-[10px] font-medium px-1.5 py-0.5 rounded inline-flex items-center gap-1",
                          t.sla === "breach" ? "bg-destructive/10 text-destructive" : t.sla === "warning" ? "bg-warning/15 text-warning" : "bg-secondary text-muted-foreground"
                        )}>
                          <Clock className="size-2.5" /> {dueLabel}
                        </span>
                        <button
                          title="Delete"
                          onClick={() => deleteMut.mutate(t.id)}
                          className="size-6 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/60">
                        <button onClick={() => move(t.id, -1)} className="text-[10px] text-muted-foreground hover:text-foreground">← Back</button>
                        <button onClick={() => move(t.id, 1)} className="text-[10px] text-primary hover:underline font-medium">Advance →</button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <DialogDescription>Add a task to the Pending column.</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submitCreate(); }}>
            <div className="space-y-1.5"><Label>Title</Label><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Follow up on offer" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Client</Label>
                <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Optional client" /></SelectTrigger>
                  <SelectContent>
                    {clientsList.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Candidate / Note</Label><Input value={form.candidate} onChange={(e) => setForm({ ...form, candidate: e.target.value })} placeholder="Optional" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Kind</Label>
                  <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                      {kinds.map((k) => (
                        <SelectItem key={k} value={k}>{k}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                  <button
                    type="button"
                    onClick={() => setManageKindsOpen(true)}
                    className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <Pencil className="size-3" /> Manage kinds
                  </button>
              </div>
              <div className="space-y-1.5">
                <Label>Due</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !form.dueDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 size-4" />
                      {form.dueDate ? format(form.dueDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.dueDate}
                      onSelect={(d) => setForm({ ...form, dueDate: d })}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending ? "Creating…" : "Create task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={manageKindsOpen} onOpenChange={setManageKindsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage task kinds</DialogTitle>
            <DialogDescription>Add or remove the kinds available when creating a task.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={newKind}
                onChange={(e) => setNewKind(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKind(); } }}
                placeholder="e.g. Negotiate offer"
              />
              <Button type="button" onClick={addKind}><Plus className="size-4" /> Add</Button>
            </div>
            <div className="rounded-md border border-border divide-y divide-border max-h-72 overflow-y-auto">
              {kinds.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-6">No kinds yet — add one above.</div>
              )}
              {kinds.map((k) => (
                <div key={k} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>{k}</span>
                  <button
                    type="button"
                    onClick={() => removeKind(k)}
                    className="text-[11px] text-destructive hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setManageKindsOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}