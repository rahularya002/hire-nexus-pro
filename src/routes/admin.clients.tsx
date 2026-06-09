import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Building2, AlertCircle, Mail, Phone, Loader2, Check, Trash2, Copy, KeyRound, Eye, EyeOff, RefreshCw } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { listClients, onboardClientWithLogin, deleteClient, type ClientRow } from "@/lib/clients.functions";
import { colorFor, initialsOf, daysSince } from "@/lib/display";

export const Route = createFileRoute("/admin/clients")({
  component: () => <AppShell><Page /></AppShell>,
});

function Page() {
  const [open, setOpen] = useState(false);
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin") || roles.includes("lead_recruiter");
  const fetchClients = useServerFn(listClients);
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: () => fetchClients(),
  });
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const activeCount = clients.filter((c) => c.status === "active").length;
  const inactiveCount = clients.length - activeCount;
  const visible = clients.filter((c) =>
    filter === "all" ? true : filter === "active" ? c.status === "active" : c.status === "inactive",
  );
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Client administration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {clients.length} total · {activeCount} active · {inactiveCount} inactive
          </p>
        </div>
        <div className="flex gap-2">
          <div className="inline-flex rounded-md border border-input bg-card overflow-hidden">
            {(["all", "active", "inactive"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`h-9 px-3 text-xs font-medium capitalize ${filter === f ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60"}`}>{f}</button>
            ))}
          </div>
          {isAdmin && (
            <button onClick={() => setOpen(true)} className="h-9 inline-flex items-center gap-1.5 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium">
              <Plus className="size-4" /> New client
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="divide-y divide-border">
          {isLoading && (
            <div className="p-10 text-center text-sm text-muted-foreground inline-flex items-center justify-center gap-2 w-full"><Loader2 className="size-4 animate-spin" /> Loading clients…</div>
          )}
          {!isLoading && visible.map((c) => (
            <ClientItem key={c.id} c={c} isAdmin={isAdmin} />
          ))}
          {!isLoading && visible.length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">
              {clients.length === 0 ? "No clients yet. Onboard your first client to get started." : "No clients match this filter."}
            </div>
          )}
        </div>
      </div>

      {open && <OnboardModal onClose={() => setOpen(false)} />}
    </div>
  );
}

function ClientItem({ c, isAdmin }: { c: ClientRow; isAdmin: boolean }) {
  const qc = useQueryClient();
  const del = useServerFn(deleteClient);
  const lastActivity = daysSince(c.last_activity_at ?? c.created_at);
  const color = colorFor(c.id, c.color);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete ${c.name}? This also removes its positions.`)) return;
    try {
      await del({ data: { id: c.id } });
      toast.success("Client deleted");
      qc.invalidateQueries({ queryKey: ["clients"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete");
    }
  }

  return (
    <Link to="/clients/$clientId" params={{ clientId: c.id }} className="block px-5 py-4 hover:bg-secondary/30 transition">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="size-10 rounded-md grid place-items-center text-xs font-bold text-primary-foreground" style={{ background: color }}>{initialsOf(c.name)}</div>
          <div className="min-w-0">
            <div className="font-medium truncate">{c.name}</div>
            <div className="text-xs text-muted-foreground truncate">
              {[c.industry, c.contact_name && `SPOC ${c.contact_name}`].filter(Boolean).join(" · ") || "—"}
            </div>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-6 text-xs">
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Open positions</div>
            <div className="text-sm font-semibold tabular-nums">{c.open_positions ?? 0}</div>
          </div>
          {c.contact_email && (
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1"><Mail className="size-3" /> Email</div>
              <div className="text-sm truncate max-w-[180px]">{c.contact_email}</div>
            </div>
          )}
          {c.contact_phone && (
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1"><Phone className="size-3" /> Phone</div>
              <div className="text-sm">{c.contact_phone}</div>
            </div>
          )}
          {lastActivity !== null && (
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Last activity</div>
              <div className="text-sm">{lastActivity === 0 ? "Today" : `${lastActivity}d ago`}</div>
            </div>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {c.status === "inactive" ? (
            <span className="inline-flex items-center gap-1 text-xs text-warning font-medium px-2 py-1 rounded bg-warning/10 border border-warning/20"><AlertCircle className="size-3" /> Inactive</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-success font-medium px-2 py-1 rounded bg-success/10 border border-success/20"><Check className="size-3" /> Active</span>
          )}
          {isAdmin && (
            <button onClick={handleDelete} className="size-8 grid place-items-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10" aria-label="Delete client">
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}

function OnboardModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const onboardFn = useServerFn(onboardClientWithLogin);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [website, setWebsite] = useState("");
  const [pan, setPan] = useState("");
  const [gst, setGst] = useState("");
  const [address, setAddress] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState(() => generatePassword());
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string; name: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Company name is required."); return; }
    if (!loginEmail.trim()) { setError("Login email is required."); return; }
    if (loginPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
    setSubmitting(true);
    try {
      await onboardFn({
        data: {
          name: name.trim(),
          industry: industry.trim() || undefined,
          contact_name: contactName.trim() || undefined,
          contact_email: loginEmail.trim(),
          contact_phone: contactPhone.trim() || undefined,
          notes: notes.trim() || undefined,
          website: website.trim() || undefined,
          pan_number: pan.trim() || undefined,
          gst_number: gst.trim() || undefined,
          registered_address: address.trim() || undefined,
          login_email: loginEmail.trim(),
          login_password: loginPassword,
          full_name: contactName.trim() || undefined,
        },
      });
      toast.success(`Client "${name.trim()}" onboarded`);
      qc.invalidateQueries({ queryKey: ["clients"] });
      setCreated({ email: loginEmail.trim(), password: loginPassword, name: name.trim() });
    } catch (err: any) {
      setError(err?.message ?? "Failed to create client.");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 backdrop-blur-sm p-4" onClick={onClose}>
        <div className="w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="p-5 border-b border-border flex items-center gap-3">
            <div className="size-10 rounded-lg bg-success/10 grid place-items-center text-success">
              <Check className="size-5" />
            </div>
            <div>
              <div className="font-semibold">{created.name} onboarded</div>
              <div className="text-xs text-muted-foreground">Share these login credentials with the client — they won't be shown again.</div>
            </div>
          </div>
          <div className="p-5 space-y-3">
            <CopyRow label="Login email" value={created.email} />
            <CopyRow label="Temporary password" value={created.password} mono />
            <div className="rounded-lg bg-warning/10 border border-warning/20 p-3 text-xs text-warning-foreground/90 flex gap-2">
              <AlertCircle className="size-4 mt-0.5 shrink-0 text-warning" />
              <span>Ask the client to change this password after first sign-in.</span>
            </div>
          </div>
          <div className="p-5 border-t border-border flex justify-end">
            <button onClick={onClose} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium">Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 backdrop-blur-sm p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-border flex items-center gap-3">
          <div className="size-10 rounded-lg bg-primary/10 grid place-items-center text-primary">
            <Building2 className="size-5" />
          </div>
          <div>
            <div className="font-semibold">New client</div>
            <div className="text-xs text-muted-foreground">Add a company to start tracking mandates and positions</div>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <Field label="Company name" placeholder="e.g. Tata Digital" value={name} onChange={setName} />
          <Field label="Industry" placeholder="e.g. Technology" value={industry} onChange={setIndustry} />
          <Field label="Contact person (SPOC)" placeholder="Full name" value={contactName} onChange={setContactName} />
          <Field label="Contact phone" placeholder="+91 …" value={contactPhone} onChange={setContactPhone} />
          <Field label="Website (optional)" placeholder="https://company.com" value={website} onChange={setWebsite} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="PAN (optional)" placeholder="ABCDE1234F" value={pan} onChange={setPan} />
            <Field label="GSTIN (optional)" placeholder="22ABCDE1234F1Z5" value={gst} onChange={setGst} />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground/80">Registered address (optional)</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              placeholder="Street, city, state, PIN"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground/80">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Internal notes about this account…"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>

          <div className="mt-2 pt-4 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <KeyRound className="size-4 text-primary" />
              <div className="text-sm font-semibold">Client portal login</div>
            </div>
            <Field label="Login email" placeholder="contact@company.com" value={loginEmail} onChange={setLoginEmail} type="email" />
            <div className="mt-3">
              <label className="text-xs font-medium text-foreground/80">Temporary password</label>
              <div className="mt-1 flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showPw ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 pr-9 text-sm font-mono outline-none focus:ring-2 focus:ring-ring/40"
                  />
                  <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Toggle visibility">
                    {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <button type="button" onClick={() => setLoginPassword(generatePassword())} className="h-9 px-3 rounded-md border border-input bg-background text-xs inline-flex items-center gap-1.5 hover:bg-secondary/60" aria-label="Regenerate password">
                  <RefreshCw className="size-3.5" /> Generate
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">Minimum 8 characters. You'll see this once after creating the account.</p>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="size-4" /> {error}
            </div>
          )}
        </div>
        <div className="p-5 border-t border-border flex justify-between">
          <button type="button" onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground px-3 py-2">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-2 disabled:opacity-60"
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Create client & login
          </button>
        </div>
      </form>
    </div>
  );
}

function CopyRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }
  return (
    <div>
      <label className="text-xs font-medium text-foreground/80">{label}</label>
      <div className="mt-1 flex gap-2">
        <input
          readOnly
          value={value}
          className={`flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm ${mono ? "font-mono" : ""}`}
        />
        <button type="button" onClick={copy} className="h-9 px-3 rounded-md border border-input bg-background text-xs inline-flex items-center gap-1.5 hover:bg-secondary/60">
          {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function generatePassword(len = 14) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const arr = new Uint32Array(len);
  (globalThis.crypto ?? window.crypto).getRandomValues(arr);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-foreground/80">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
      />
    </div>
  );
}