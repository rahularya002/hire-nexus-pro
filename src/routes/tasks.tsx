import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { opsTasks, type OpsTask, type TaskState } from "@/lib/ops/store";
import { ClipboardList, Phone, Mail, Send, Plus, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/tasks")({ component: TasksPage });

const COLUMNS: TaskState[] = ["Pending", "Ongoing", "Interview Pending", "Closed", "Reopened", "No-show"];

function TasksPage() {
  const [tasks, setTasks] = useState<OpsTask[]>(opsTasks);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", client: "", candidate: "", kind: "Call", due: "Today" });

  const move = (id: string, dir: 1 | -1) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const idx = COLUMNS.indexOf(t.state);
        const next = COLUMNS[Math.min(COLUMNS.length - 1, Math.max(0, idx + dir))];
        return { ...t, state: next };
      })
    );
  };

  const createTask = () => {
    if (!form.title || !form.client) {
      toast.error("Title and client are required");
      return;
    }
    setTasks((prev) => [
      {
        id: `t-${Date.now()}`,
        title: form.title,
        client: form.client,
        candidate: form.candidate || undefined,
        kind: form.kind as OpsTask["kind"],
        state: "Pending",
        sla: "ok",
        due: form.due,
      },
      ...prev,
    ]);
    setForm({ title: "", client: "", candidate: "", kind: "Call", due: "Today" });
    setOpen(false);
    toast.success("Task created");
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
                  {items.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">No tasks</div>}
                  {items.map((t) => (
                    <div key={t.id} className="rounded-lg border border-border bg-background/40 p-2.5 hover:border-primary/40 transition group">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{t.kind}</div>
                      <div className="text-sm font-medium leading-snug mt-1">{t.title}</div>
                      <div className="text-[11px] text-muted-foreground mt-1 truncate">
                        {t.client}{t.candidate && <> · {t.candidate}</>}
                      </div>
                      <div className="flex items-center justify-between mt-2.5">
                        <span className={cn(
                          "text-[10px] font-medium px-1.5 py-0.5 rounded inline-flex items-center gap-1",
                          t.sla === "breach" ? "bg-destructive/10 text-destructive" : t.sla === "warning" ? "bg-warning/15 text-warning" : "bg-secondary text-muted-foreground"
                        )}>
                          <Clock className="size-2.5" /> {t.due}
                        </span>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                          <button title="Call" className="size-6 grid place-items-center rounded hover:bg-secondary text-muted-foreground"><Phone className="size-3" /></button>
                          <button title="WhatsApp" className="size-6 grid place-items-center rounded hover:bg-secondary text-muted-foreground"><Send className="size-3" /></button>
                          <button title="Email" className="size-6 grid place-items-center rounded hover:bg-secondary text-muted-foreground"><Mail className="size-3" /></button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/60">
                        <button onClick={() => move(t.id, -1)} className="text-[10px] text-muted-foreground hover:text-foreground">← Back</button>
                        <button onClick={() => move(t.id, 1)} className="text-[10px] text-primary hover:underline font-medium">Advance →</button>
                      </div>
                    </div>
                  ))}
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
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); createTask(); }}>
            <div className="space-y-1.5"><Label>Title</Label><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Follow up on offer" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Client</Label><Input required value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} placeholder="Acme Corp" /></div>
              <div className="space-y-1.5"><Label>Candidate</Label><Input value={form.candidate} onChange={(e) => setForm({ ...form, candidate: e.target.value })} placeholder="Optional" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Kind</Label>
                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Call">Call</SelectItem>
                    <SelectItem value="Email">Email</SelectItem>
                    <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                    <SelectItem value="Interview">Interview</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Due</Label><Input value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} placeholder="Today / Tomorrow" /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">Create task</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}