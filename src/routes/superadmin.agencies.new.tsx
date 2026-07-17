import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { SuperAdminShell } from "@/components/superadmin-shell";
import { createAgency } from "@/lib/superadmin.functions";
import { NumberInput } from "@/components/ui/number-input";

export const Route = createFileRoute("/superadmin/agencies/new")({
  ssr: false,
  component: NewAgencyPage,
});

function NewAgencyPage() {
  const create = useServerFn(createAgency);
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    ownerName: "",
    ownerEmail: "",
    ownerPassword: "",
    plan: "starter" as "starter" | "professional" | "enterprise",
    trialDays: 14,
    mrrCents: 0,
  });

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await create({ data: form });
      toast.success("Agency created");
      navigate({ to: "/superadmin/agencies/$id", params: { id: res.agencyId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create agency");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SuperAdminShell>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Create Agency</h1>
          <p className="text-sm text-muted-foreground mt-1">Provision a new tenant + owner account.</p>
        </div>

        <form onSubmit={onSubmit} className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Agency name">
              <input required value={form.name} onChange={(e) => update("name", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Slug" hint="lowercase, dashes only">
              <input
                required pattern="[a-z0-9-]+"
                value={form.slug}
                onChange={(e) => update("slug", e.target.value.toLowerCase())}
                className={inputCls}
              />
            </Field>
          </div>

          <div className="pt-2 border-t border-border" />
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Owner account</div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Owner name">
              <input required value={form.ownerName} onChange={(e) => update("ownerName", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Owner email">
              <input required type="email" value={form.ownerEmail} onChange={(e) => update("ownerEmail", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Initial password" hint="Owner can change later">
              <input required type="text" minLength={8} value={form.ownerPassword} onChange={(e) => update("ownerPassword", e.target.value)} className={inputCls} />
            </Field>
          </div>

          <div className="pt-2 border-t border-border" />
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Plan</div>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Plan">
              <select value={form.plan} onChange={(e) => update("plan", e.target.value as typeof form.plan)} className={inputCls}>
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </Field>
            <Field label="Trial days">
              <NumberInput min={0} max={180} value={form.trialDays} onChange={(v) => update("trialDays", Number(v))} />
            </Field>
            <Field label="MRR (USD)">
              <NumberInput min={0} step={1000} value={form.mrrCents / 100} onChange={(v) => update("mrrCents", Math.round(Number(v) * 100))} />
            </Field>
          </div>

          <div className="pt-4 flex gap-2 justify-end">
            <button type="button" onClick={() => navigate({ to: "/superadmin/agencies" })} className="px-4 h-9 rounded-md border border-border text-sm">
              Cancel
            </button>
            <button disabled={submitting} type="submit" className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              {submitting ? "Creating…" : "Create agency"}
            </button>
          </div>
        </form>
      </div>
    </SuperAdminShell>
  );
}

const inputCls = "w-full h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40";
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-muted-foreground mb-1">{label}</div>
      {children}
      {hint && <div className="text-[11px] text-muted-foreground/70 mt-1">{hint}</div>}
    </label>
  );
}