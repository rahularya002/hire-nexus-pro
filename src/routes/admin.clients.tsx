import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Building2, KeyRound, Check, AlertCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { clients, isClientInactive, INACTIVITY_THRESHOLD_DAYS } from "@/lib/mock-data";

export const Route = createFileRoute("/admin/clients")({
  component: () => <AppShell><Page /></AppShell>,
});

function Page() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const inactiveCount = clients.filter(isClientInactive).length;
  const visible = clients.filter((c) => {
    if (filter === "all") return true;
    const inactive = isClientInactive(c);
    return filter === "inactive" ? inactive : !inactive;
  });
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Client administration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {clients.length} total · {clients.length - inactiveCount} active · {inactiveCount} inactive
            <span className="ml-2 text-[11px]">(auto-inactive after {INACTIVITY_THRESHOLD_DAYS}d of no activity unless they have open requirements)</span>
          </p>
        </div>
        <div className="flex gap-2">
          <div className="inline-flex rounded-md border border-input bg-card overflow-hidden">
            {(["all", "active", "inactive"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`h-9 px-3 text-xs font-medium capitalize ${filter === f ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60"}`}>{f}</button>
            ))}
          </div>
          <button onClick={() => setOpen(true)} className="h-9 inline-flex items-center gap-1.5 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium">
            <Plus className="size-4" /> Onboard new client
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-secondary/30 grid grid-cols-12 gap-4 text-[11px] uppercase tracking-wider text-muted-foreground">
          <div className="col-span-4">Client</div>
          <div className="col-span-3">Contact</div>
          <div className="col-span-2">Agreement</div>
          <div className="col-span-2">Login</div>
          <div className="col-span-1 text-right">Status</div>
        </div>
        <div className="divide-y divide-border">
          {visible.map(c => {
            const inactive = isClientInactive(c);
            return (
            <Link to="/clients/$clientId" params={{ clientId: c.id }} key={c.id} className="grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-secondary/30 transition">
              <div className="col-span-4 flex items-center gap-3 min-w-0">
                <div className="size-9 rounded-md grid place-items-center text-xs font-bold text-primary-foreground" style={{background: c.color}}>{c.initials}</div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.industry} · {c.lastActivityDays === 0 ? "Active today" : `Last activity ${c.lastActivityDays}d ago`}</div>
                </div>
              </div>
              <div className="col-span-3 text-sm">{c.contact}</div>
              <div className="col-span-2 text-xs text-muted-foreground">Signed · 12mo retainer</div>
              <div className="col-span-2 text-xs font-mono text-muted-foreground">{c.id}@talentflow</div>
              <div className="col-span-1 text-right">
                {inactive ? (
                  <span className="inline-flex items-center gap-1 text-xs text-warning font-medium"><AlertCircle className="size-3" /> Inactive</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-success font-medium"><Check className="size-3" /> Active</span>
                )}
              </div>
            </Link>
            );
          })}
        </div>
      </div>

      {open && <OnboardModal onClose={() => setOpen(false)} />}
    </div>
  );
}

function OnboardModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-border flex items-center gap-3">
          <div className="size-10 rounded-lg bg-primary/10 grid place-items-center text-primary">
            {step === 1 ? <Building2 className="size-5" /> : <KeyRound className="size-5" />}
          </div>
          <div>
            <div className="font-semibold">{step === 1 ? "Client profile" : "Generate login"}</div>
            <div className="text-xs text-muted-foreground">Step {step} of 2</div>
          </div>
        </div>
        <div className="p-5 space-y-3">
          {step === 1 ? (
            <>
              <Field label="Company name" placeholder="e.g. Tata Digital" />
              <Field label="Contact person" placeholder="Full name" />
              <Field label="Email" placeholder="contact@company.com" />
              <Field label="Billing terms" placeholder="8.33% of fixed CTC" />
              <Field label="Agreement validity" placeholder="12 months" />
            </>
          ) : (
            <div className="space-y-3">
              <Field label="Client login email" placeholder="hr@company.com" />
              <Field label="Temporary password" placeholder="Auto-generated" />
              <div className="rounded-lg bg-success/10 border border-success/20 p-3 text-sm text-success flex items-center gap-2">
                <Check className="size-4" /> Welcome email will be sent automatically.
              </div>
            </div>
          )}
        </div>
        <div className="p-5 border-t border-border flex justify-between">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground px-3 py-2">Cancel</button>
          <button
            onClick={() => step === 1 ? setStep(2) : onClose()}
            className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium"
          >
            {step === 1 ? "Continue" : "Create client"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-foreground/80">{label}</label>
      <input placeholder={placeholder} className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40" />
    </div>
  );
}