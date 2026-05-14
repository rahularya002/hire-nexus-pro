import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Building2, KeyRound, Check } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { clients } from "@/lib/mock-data";

export const Route = createFileRoute("/admin/clients")({
  component: () => <AppShell><Page /></AppShell>,
});

function Page() {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Client administration</h1>
          <p className="text-sm text-muted-foreground mt-1">Onboard new clients, manage agreements & access credentials</p>
        </div>
        <button onClick={() => setOpen(true)} className="h-9 inline-flex items-center gap-1.5 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium">
          <Plus className="size-4" /> Onboard new client
        </button>
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
          {clients.map(c => (
            <div key={c.id} className="grid grid-cols-12 gap-4 px-5 py-4 items-center">
              <div className="col-span-4 flex items-center gap-3 min-w-0">
                <div className="size-9 rounded-md grid place-items-center text-xs font-bold text-primary-foreground" style={{background: c.color}}>{c.initials}</div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.industry}</div>
                </div>
              </div>
              <div className="col-span-3 text-sm">{c.contact}</div>
              <div className="col-span-2 text-xs text-muted-foreground">Signed · 12mo retainer</div>
              <div className="col-span-2 text-xs font-mono text-muted-foreground">{c.id}@talentflow</div>
              <div className="col-span-1 text-right">
                <span className="inline-flex items-center gap-1 text-xs text-success font-medium"><Check className="size-3" /> Active</span>
              </div>
            </div>
          ))}
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