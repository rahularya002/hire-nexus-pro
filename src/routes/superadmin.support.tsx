import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { SuperAdminShell } from "@/components/superadmin-shell";
import { listTickets, updateTicket, createTicket, listAgencies } from "@/lib/superadmin.functions";

export const Route = createFileRoute("/superadmin/support")({
  ssr: false,
  component: SupportPage,
});

const TYPES = ["all", "support", "billing", "feature_request"] as const;

function SupportPage() {
  const fetchTickets = useServerFn(listTickets);
  const fetchAgencies = useServerFn(listAgencies);
  const update = useServerFn(updateTicket);
  const create = useServerFn(createTicket);
  const qc = useQueryClient();

  const { data } = useQuery({ queryKey: ["sa", "tickets"], queryFn: () => fetchTickets() });
  const { data: ags } = useQuery({ queryKey: ["sa", "agencies"], queryFn: () => fetchAgencies() });

  const [filter, setFilter] = useState<(typeof TYPES)[number]>("all");
  const [showNew, setShowNew] = useState(false);

  const tickets = (data?.tickets ?? []).filter((t) => filter === "all" || t.type === filter);
  const refresh = () => qc.invalidateQueries({ queryKey: ["sa", "tickets"] });

  return (
    <SuperAdminShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Support Center</h1>
            <p className="text-sm text-muted-foreground mt-1">Tickets, billing and feature requests from agencies.</p>
          </div>
          <button onClick={() => setShowNew((s) => !s)} className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
            {showNew ? "Cancel" : "New ticket"}
          </button>
        </div>

        {showNew && (
          <NewTicketForm agencies={ags?.agencies ?? []} onCreated={() => { setShowNew(false); refresh(); }} createFn={create as CreateTicketFn} />
        )}

        <div className="flex gap-2 text-xs">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3 py-1.5 rounded-full border capitalize ${filter === t ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"}`}
            >
              {t.replace("_", " ")}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Subject</th>
                <th className="text-left px-4 py-2 font-medium">Agency</th>
                <th className="text-left px-4 py-2 font-medium">Type</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">Created</th>
                <th className="text-right px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No tickets in this view.</td></tr>
              )}
              {tickets.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <div className="font-medium">{t.subject}</div>
                    {t.body && <div className="text-xs text-muted-foreground line-clamp-1">{t.body}</div>}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{(t as { agencies?: { name?: string } }).agencies?.name ?? "—"}</td>
                  <td className="px-4 py-2 capitalize">{t.type.replace("_", " ")}</td>
                  <td className="px-4 py-2">
                    <select
                      value={t.status}
                      onChange={async (e) => {
                        try {
                          await update({ data: { id: t.id, status: e.target.value as "open" | "in_progress" | "resolved" | "closed" } });
                          toast.success("Updated");
                          refresh();
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Failed");
                        }
                      }}
                      className="h-7 text-xs rounded border border-input bg-background px-2"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </SuperAdminShell>
  );
}

type CreateTicketFn = (args: {
  data: {
    agency_id: string | null;
    type: "support" | "billing" | "feature_request";
    subject: string;
    body?: string;
    priority?: string;
  };
}) => Promise<unknown>;

function NewTicketForm({
  agencies,
  onCreated,
  createFn,
}: {
  agencies: { id: string; name: string }[];
  onCreated: () => void;
  createFn: CreateTicketFn;
}) {
  const [form, setForm] = useState({
    agency_id: "" as string,
    type: "support" as "support" | "billing" | "feature_request",
    subject: "",
    body: "",
    priority: "normal",
  });
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await createFn({ data: { ...form, agency_id: form.agency_id || null } });
          toast.success("Ticket created");
          onCreated();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed");
        } finally {
          setBusy(false);
        }
      }}
      className="rounded-xl border border-border bg-card p-5 space-y-3"
    >
      <div className="grid sm:grid-cols-3 gap-3">
        <select value={form.agency_id} onChange={(e) => setForm({ ...form, agency_id: e.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">(no agency)</option>
          {agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="support">Support</option>
          <option value="billing">Billing</option>
          <option value="feature_request">Feature request</option>
        </select>
        <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>
      <input required placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" />
      <textarea placeholder="Body" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      <div className="flex justify-end">
        <button disabled={busy} type="submit" className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
          {busy ? "Creating…" : "Create ticket"}
        </button>
      </div>
    </form>
  );
}