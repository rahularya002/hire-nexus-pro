import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Building2, AlertCircle, Mail, Phone, TrendingUp, Eye, EyeOff, Loader2, Check, IndianRupee } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { createClientAccount } from "@/lib/team.functions";
import { AppShell } from "@/components/app-shell";
import { clients, isClientInactive, INACTIVITY_MANDATE_DAYS, INACTIVITY_CLOSURE_DAYS, type Client } from "@/lib/mock-data";
import { formatInrShort } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";

export const Route = createFileRoute("/admin/clients")({
  component: () => <AppShell><Page /></AppShell>,
});

function Page() {
  const [open, setOpen] = useState(false);
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  // Recruiters never see inactive accounts.
  const scoped = isAdmin ? clients : clients.filter((c) => !isClientInactive(c));
  const [filter, setFilter] = useState<"all" | "active" | "inactive">(isAdmin ? "all" : "active");
  const inactiveCount = scoped.filter(isClientInactive).length;
  const visible = scoped.filter((c) => {
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
            {scoped.length} total · {scoped.length - inactiveCount} active{isAdmin && ` · ${inactiveCount} inactive`}
            {isAdmin && (
              <span className="ml-2 text-[11px]">(auto-inactive after {INACTIVITY_MANDATE_DAYS}d without a new mandate or {INACTIVITY_CLOSURE_DAYS}d without a closure)</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <div className="inline-flex rounded-md border border-input bg-card overflow-hidden">
              {(["all", "active", "inactive"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={`h-9 px-3 text-xs font-medium capitalize ${filter === f ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60"}`}>{f}</button>
              ))}
            </div>
          )}
          <button onClick={() => setOpen(true)} className="h-9 inline-flex items-center gap-1.5 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium">
            <Plus className="size-4" /> Onboard new client
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="divide-y divide-border">
          {visible.map((c) => (
            <ClientRow key={c.id} c={c} isAdmin={isAdmin} />
          ))}
          {visible.length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">No clients match this filter.</div>
          )}
        </div>
      </div>

      {open && <OnboardModal onClose={() => setOpen(false)} />}
    </div>
  );
}

function ClientRow({ c, isAdmin }: { c: Client; isAdmin: boolean }) {
  const inactive = isClientInactive(c);
  const mandateFlag = c.lastMandateDays > INACTIVITY_MANDATE_DAYS;
  const closureFlag = c.lastClosureDays > INACTIVITY_CLOSURE_DAYS;
  return (
    <Link to="/clients/$clientId" params={{ clientId: c.id }} className="block px-5 py-4 hover:bg-secondary/30 transition">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="size-10 rounded-md grid place-items-center text-xs font-bold text-primary-foreground" style={{ background: c.color }}>{c.initials}</div>
          <div className="min-w-0">
            <div className="font-medium truncate">{c.name}</div>
            <div className="text-xs text-muted-foreground truncate">{c.industry} · SPOC {c.spoc.name}</div>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-6 text-xs">
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Closures YTD</div>
            <div className="text-sm font-semibold tabular-nums">{c.positionsClosedYTD}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Revenue YTD</div>
            <div className="text-sm font-semibold tabular-nums inline-flex items-center gap-0.5"><IndianRupee className="size-3" />{formatInrShort(c.revenueYTDInr).replace("₹", "")}</div>
          </div>
        </div>
        <div className="shrink-0">
          {inactive ? (
            <span className="inline-flex items-center gap-1 text-xs text-warning font-medium px-2 py-1 rounded bg-warning/10 border border-warning/20"><AlertCircle className="size-3" /> Inactive</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-success font-medium px-2 py-1 rounded bg-success/10 border border-success/20"><Check className="size-3" /> Active</span>
          )}
        </div>
      </div>

      {isAdmin && inactive && (
        <div className="mt-3 ml-13 grid grid-cols-2 md:grid-cols-4 gap-3 rounded-lg border border-warning/20 bg-warning/5 p-3 text-xs">
          <Metric
            label="Last mandate"
            value={`${c.lastMandateDays}d ago`}
            flag={mandateFlag}
            sublabel={mandateFlag ? `> ${INACTIVITY_MANDATE_DAYS}d` : undefined}
          />
          <Metric
            label="Last closure"
            value={`${c.lastClosureDays}d ago`}
            flag={closureFlag}
            sublabel={closureFlag ? `> ${INACTIVITY_CLOSURE_DAYS}d` : undefined}
          />
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">SPOC</div>
            <div className="font-medium truncate">{c.spoc.name}</div>
            <div className="text-muted-foreground inline-flex items-center gap-1 truncate"><Mail className="size-3" />{c.spoc.email}</div>
            <div className="text-muted-foreground inline-flex items-center gap-1"><Phone className="size-3" />{c.spoc.phone}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1"><TrendingUp className="size-3" />YTD</div>
            <div className="font-medium">{c.positionsClosedYTD} closures</div>
            <div className="text-muted-foreground">{formatInrShort(c.revenueYTDInr)} revenue</div>
          </div>
        </div>
      )}
    </Link>
  );
}

function Metric({ label, value, flag, sublabel }: { label: string; value: string; flag?: boolean; sublabel?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-medium ${flag ? "text-warning" : ""}`}>{value}</div>
      {sublabel && <div className="text-[10px] text-warning/80">{sublabel}</div>}
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