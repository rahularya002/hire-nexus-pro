import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  upsertBillingTerms, FEE_MODELS, REPLACEMENT_POLICIES, BILLING_CYCLES,
  type BillingTerms, type FeeModel, type ReplacementPolicy, type BillingCycle, type TierBand,
} from "@/lib/billing.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  initial: BillingTerms;
  onSaved?: () => void;
};

type Draft = {
  fee_model: FeeModel;
  fee_value: number;
  tiers: TierBand[];
  replacement_window_days: number;
  replacement_policy: ReplacementPolicy;
  billing_cycle: BillingCycle;
  invoice_day_of_month: number;
  payment_terms_days: number;
  gst_pct: number;
  tds_pct: number;
  currency: string;
  po_required: boolean;
  po_number: string;
};

function fromTerms(t: BillingTerms): Draft {
  return {
    fee_model: t.fee_model,
    fee_value: Number(t.fee_value),
    tiers: t.tiers ?? [],
    replacement_window_days: t.replacement_window_days,
    replacement_policy: t.replacement_policy,
    billing_cycle: t.billing_cycle,
    invoice_day_of_month: t.invoice_day_of_month,
    payment_terms_days: t.payment_terms_days,
    gst_pct: Number(t.gst_pct),
    tds_pct: Number(t.tds_pct),
    currency: t.currency || "INR",
    po_required: t.po_required,
    po_number: t.po_number ?? "",
  };
}

export function EditTermsDialog({ open, onOpenChange, clientId, initial, onSaved }: Props) {
  const [draft, setDraft] = useState<Draft>(() => fromTerms(initial));
  const [error, setError] = useState<string | null>(null);
  const upsertFn = useServerFn(upsertBillingTerms);

  useEffect(() => {
    if (open) {
      setDraft(fromTerms(initial));
      setError(null);
    }
  }, [open, initial]);

  const save = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          clientId,
          fee_model: draft.fee_model,
          fee_value: Number(draft.fee_value) || 0,
          tiers: draft.fee_model === "tiered" ? draft.tiers.map((t) => ({
            upToCtcInr: Number(t.upToCtcInr) || 0,
            flatFeeInr: Number(t.flatFeeInr) || 0,
          })) : [],
          replacement_window_days: Number(draft.replacement_window_days) || 0,
          replacement_policy: draft.replacement_policy,
          billing_cycle: draft.billing_cycle,
          invoice_day_of_month: Number(draft.invoice_day_of_month) || 1,
          payment_terms_days: Number(draft.payment_terms_days) || 0,
          gst_pct: Number(draft.gst_pct) || 0,
          tds_pct: Number(draft.tds_pct) || 0,
          currency: draft.currency || "INR",
          po_required: draft.po_required,
          po_number: draft.po_required ? (draft.po_number || null) : null,
        },
      }),
    onSuccess: () => {
      onSaved?.();
      onOpenChange(false);
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "Failed to save"),
  });

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit commercial terms</DialogTitle>
          <DialogDescription>Changes apply to future invoice runs. Existing invoices are untouched.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Fee model */}
          <section className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Fee structure</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Fee model">
                <Select value={draft.fee_model} onValueChange={(v) => set("fee_model", v as FeeModel)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FEE_MODELS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m === "percent_ctc" ? "% of CTC" : m === "flat_per_hire" ? "Flat per hire" : "Tiered"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {draft.fee_model !== "tiered" && (
                <Field label={draft.fee_model === "percent_ctc" ? "Percent of CTC" : "Flat fee (INR)"}>
                  <NumberInput step={0.01} min={0} value={draft.fee_value}
                    onChange={(v) => set("fee_value", Number(v))} />
                </Field>
              )}
            </div>

            {draft.fee_model === "tiered" && (
              <div className="rounded-lg border border-border/60 bg-secondary/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Tier bands</div>
                  <button type="button"
                    onClick={() => set("tiers", [...draft.tiers, { upToCtcInr: 0, flatFeeInr: 0 }])}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <Plus className="size-3.5" /> Add tier
                  </button>
                </div>
                {draft.tiers.length === 0 && (
                  <div className="text-xs text-muted-foreground py-2">No tiers yet. Add one to begin.</div>
                )}
                {draft.tiers.map((t, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                    <Field label="CTC up to (INR)" small>
                      <NumberInput min={0} step={100000} value={t.upToCtcInr}
                        onChange={(v) => {
                          const next = [...draft.tiers];
                          next[idx] = { ...next[idx], upToCtcInr: Number(v) };
                          set("tiers", next);
                        }} />
                    </Field>
                    <Field label="Flat fee (INR)" small>
                      <NumberInput min={0} step={5000} value={t.flatFeeInr}
                        onChange={(v) => {
                          const next = [...draft.tiers];
                          next[idx] = { ...next[idx], flatFeeInr: Number(v) };
                          set("tiers", next);
                        }} />
                    </Field>
                    <button type="button"
                      onClick={() => set("tiers", draft.tiers.filter((_, i) => i !== idx))}
                      className="h-9 px-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Billing cycle */}
          <section className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Billing cycle</h3>
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Cycle">
                <Select value={draft.billing_cycle} onValueChange={(v) => set("billing_cycle", v as BillingCycle)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BILLING_CYCLES.map((c) => (
                      <SelectItem key={c} value={c}>{c === "monthly" ? "Monthly" : "Per joining"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Invoice day (1–28)">
                <NumberInput min={1} max={28} value={draft.invoice_day_of_month}
                  onChange={(v) => set("invoice_day_of_month", Number(v))} />
              </Field>
              <Field label="Payment terms (days)">
                <NumberInput min={0} max={180} value={draft.payment_terms_days}
                  onChange={(v) => set("payment_terms_days", Number(v))} />
              </Field>
            </div>
          </section>

          {/* Replacement */}
          <section className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Replacement guarantee</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Window (days)">
                <NumberInput min={0} max={365} value={draft.replacement_window_days}
                  onChange={(v) => set("replacement_window_days", Number(v))} />
              </Field>
              <Field label="Policy">
                <Select value={draft.replacement_policy} onValueChange={(v) => set("replacement_policy", v as ReplacementPolicy)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REPLACEMENT_POLICIES.map((p) => (
                      <SelectItem key={p} value={p}>{p.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </section>

          {/* Taxes & PO */}
          <section className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Taxes & PO</h3>
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="GST %">
                <NumberInput step={0.01} min={0} max={50} value={draft.gst_pct}
                  onChange={(v) => set("gst_pct", Number(v))} />
              </Field>
              <Field label="TDS %">
                <NumberInput step={0.01} min={0} max={50} value={draft.tds_pct}
                  onChange={(v) => set("tds_pct", Number(v))} />
              </Field>
              <Field label="Currency">
                <Input value={draft.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} />
              </Field>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={draft.po_required} onCheckedChange={(v) => set("po_required", v)} id="po-req" />
              <Label htmlFor="po-req" className="text-sm">Purchase order required</Label>
            </div>
            {draft.po_required && (
              <Field label="PO number (optional)">
                <Input value={draft.po_number} onChange={(e) => set("po_number", e.target.value)} placeholder="e.g. PO-2026-0042" />
              </Field>
            )}
          </section>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/25 rounded-md px-3 py-2">{error}</div>
          )}
        </div>

        <DialogFooter>
          <button type="button" onClick={() => onOpenChange(false)}
            className="px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button type="button" onClick={() => save.mutate()} disabled={save.isPending}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:opacity-90 transition">
            {save.isPending ? "Saving…" : "Save terms"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, small, children }: { label: string; small?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className={small ? "text-[11px] uppercase tracking-wider text-muted-foreground" : "text-xs text-muted-foreground"}>{label}</Label>
      {children}
    </div>
  );
}
