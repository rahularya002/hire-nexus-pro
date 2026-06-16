import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ---------- Types & enums ---------- */

export const FEE_MODELS = ["percent_ctc", "flat_per_hire", "tiered"] as const;
export type FeeModel = (typeof FEE_MODELS)[number];

export const REPLACEMENT_POLICIES = ["free_replacement", "pro_rata_credit", "none"] as const;
export type ReplacementPolicy = (typeof REPLACEMENT_POLICIES)[number];

export const BILLING_CYCLES = ["monthly", "per_joining"] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export const INVOICE_STATUSES = ["draft", "sent", "paid", "overdue", "cancelled"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const LINE_KINDS = ["placement", "replacement_covered", "credit_left_in_window"] as const;
export type LineKind = (typeof LINE_KINDS)[number];

export type TierBand = { upToCtcInr: number; flatFeeInr: number };

export type BillingTerms = {
  id: string;
  client_id: string;
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
  po_number: string | null;
};

export type InvoiceRow = {
  id: string;
  invoice_no: string;
  client_id: string;
  period_from: string;
  period_to: string;
  issue_date: string;
  due_date: string;
  po_number: string | null;
  subtotal_inr: number;
  gst_inr: number;
  tds_inr: number;
  total_inr: number;
  status: InvoiceStatus;
  notes: string | null;
  created_at: string;
};

export type InvoiceLineItemRow = {
  id: string;
  invoice_id: string;
  placement_id: string | null;
  candidate_name: string;
  position_title: string;
  joining_date: string | null;
  ctc_inr: number | null;
  fee_basis: string;
  amount_inr: number;
  kind: LineKind;
};

export type ClientLite = { id: string; name: string };

/* ---------- Pure helpers ---------- */

export function fmtINR(amountInr: number): string {
  const sign = amountInr < 0 ? "-" : "";
  const v = Math.abs(amountInr);
  if (v >= 10_000_000) return `${sign}₹${(v / 10_000_000).toFixed(2)} Cr`;
  if (v >= 100_000) return `${sign}₹${(v / 100_000).toFixed(2)} L`;
  return `${sign}₹${Math.round(v).toLocaleString("en-IN")}`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00Z" : iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function isoDate(d: Date) { return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }
function addDays(d: Date, n: number) { const r = new Date(d); r.setUTCDate(r.getUTCDate() + n); return r; }
function addMonths(d: Date, n: number) { const r = new Date(d); r.setUTCMonth(r.getUTCMonth() + n); return r; }

export function getOpenCycle(terms: BillingTerms, today: Date = new Date()) {
  const day = terms.invoice_day_of_month;
  const y = today.getUTCFullYear(), m = today.getUTCMonth(), d = today.getUTCDate();
  const periodEnd = d >= day
    ? new Date(Date.UTC(y, m, day - 1))
    : new Date(Date.UTC(y, m - 1, day - 1));
  const periodStart = addDays(addMonths(periodEnd, -1), 1);
  const issue = addDays(periodEnd, 1);
  const due = addDays(issue, terms.payment_terms_days);
  return { from: isoDate(periodStart), to: isoDate(periodEnd), issueDate: isoDate(issue), dueDate: isoDate(due) };
}

export function nextInvoiceRun(terms: BillingTerms, today: Date = new Date()) {
  const day = terms.invoice_day_of_month;
  const y = today.getUTCFullYear(), m = today.getUTCMonth(), d = today.getUTCDate();
  const next = d < day ? new Date(Date.UTC(y, m, day)) : new Date(Date.UTC(y, m + 1, day));
  return isoDate(next);
}

export function feeForCtc(terms: BillingTerms, ctcInr: number): { amountInr: number; basis: string } {
  if (terms.fee_model === "percent_ctc") {
    return { amountInr: Math.round(ctcInr * (terms.fee_value / 100)), basis: `${terms.fee_value}% of ${fmtINR(ctcInr)}` };
  }
  if (terms.fee_model === "flat_per_hire") {
    return { amountInr: terms.fee_value, basis: `Flat ${fmtINR(terms.fee_value)} per hire` };
  }
  const tier = (terms.tiers ?? []).find((t) => ctcInr <= t.upToCtcInr);
  return { amountInr: tier?.flatFeeInr ?? 0, basis: `Tier (CTC ≤ ${fmtINR(tier?.upToCtcInr ?? 0)}) → ${fmtINR(tier?.flatFeeInr ?? 0)}` };
}

function totals(items: { amount_inr: number }[], terms: BillingTerms) {
  const subtotal = items.reduce((a, i) => a + Number(i.amount_inr || 0), 0);
  const gst = +(subtotal * (terms.gst_pct / 100)).toFixed(2);
  const tds = +(subtotal * (terms.tds_pct / 100)).toFixed(2);
  const total = +(subtotal + gst - tds).toFixed(2);
  return { subtotal: +subtotal.toFixed(2), gst, tds, total };
}

function termsRowToTyped(row: Record<string, unknown>): BillingTerms {
  return {
    id: String(row.id),
    client_id: String(row.client_id),
    fee_model: row.fee_model as FeeModel,
    fee_value: Number(row.fee_value),
    tiers: (row.tiers as TierBand[]) ?? [],
    replacement_window_days: Number(row.replacement_window_days),
    replacement_policy: row.replacement_policy as ReplacementPolicy,
    billing_cycle: row.billing_cycle as BillingCycle,
    invoice_day_of_month: Number(row.invoice_day_of_month),
    payment_terms_days: Number(row.payment_terms_days),
    gst_pct: Number(row.gst_pct),
    tds_pct: Number(row.tds_pct),
    currency: String(row.currency ?? "INR"),
    po_required: Boolean(row.po_required),
    po_number: (row.po_number as string | null) ?? null,
  };
}

function defaultTermsFor(clientId: string): BillingTerms {
  return {
    id: "default",
    client_id: clientId,
    fee_model: "percent_ctc",
    fee_value: 8.33,
    tiers: [],
    replacement_window_days: 90,
    replacement_policy: "free_replacement",
    billing_cycle: "monthly",
    invoice_day_of_month: 1,
    payment_terms_days: 30,
    gst_pct: 18,
    tds_pct: 10,
    currency: "INR",
    po_required: false,
    po_number: null,
  };
}

/* ---------- Placement-derived line items ---------- */

type SupaClient = { from: (t: string) => any };

type RawPlacement = {
  id: string;
  joining_date: string | null;
  offer_date?: string | null;
  ctc_inr: number | null;
  candidate: { name: string } | { name: string }[] | null;
  position: { title: string } | { title: string }[] | null;
};

function pickName(c: RawPlacement["candidate"]): string {
  if (!c) return "—";
  return Array.isArray(c) ? c[0]?.name ?? "—" : c.name ?? "—";
}
function pickTitle(p: RawPlacement["position"]): string {
  if (!p) return "—";
  return Array.isArray(p) ? p[0]?.title ?? "—" : p.title ?? "—";
}

async function accruedFromPlacements(
  supabase: SupaClient,
  clientId: string,
  terms: BillingTerms,
  fromIso: string,
  toIso: string,
) {
  const { data, error } = await supabase
    .from("placements")
    .select("id, joining_date, offer_date, ctc_inr, candidate:candidates(name), position:positions(title)")
    .eq("client_id", clientId)
    .not("joining_date", "is", null)
    .gte("joining_date", fromIso)
    .lte("joining_date", toIso);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as RawPlacement[];
  return rows.map((p) => {
    const ctc = Number(p.ctc_inr ?? 0);
    const fee = feeForCtc(terms, ctc);
    return {
      placement_id: p.id,
      candidate_name: pickName(p.candidate),
      position_title: pickTitle(p.position),
      joining_date: p.joining_date,
      ctc_inr: ctc,
      fee_basis: fee.basis,
      amount_inr: fee.amountInr,
      kind: "placement" as LineKind,
    };
  });
}

/* ---------- Server functions ---------- */

export const listInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .order("issue_date", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as InvoiceRow[];
  });

export const listOwnClientInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .order("issue_date", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as InvoiceRow[];
  });

export const getInvoice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { invoiceId: string }) => z.object({ invoiceId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: inv, error } = await supabase.from("invoices").select("*").eq("id", data.invoiceId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!inv) return null;
    const { data: items, error: e2 } = await supabase
      .from("invoice_line_items")
      .select("*")
      .eq("invoice_id", data.invoiceId)
      .order("joining_date", { ascending: true });
    if (e2) throw new Error(e2.message);
    const { data: termsRow } = await supabase
      .from("client_billing_terms")
      .select("*")
      .eq("client_id", inv.client_id)
      .maybeSingle();
    const { data: client } = await supabase.from("clients").select("name").eq("id", inv.client_id).maybeSingle();
    return {
      invoice: inv as InvoiceRow,
      items: (items ?? []) as InvoiceLineItemRow[],
      terms: termsRow ? termsRowToTyped(termsRow) : defaultTermsFor(inv.client_id),
      clientName: client?.name ?? "—",
    };
  });

export const setInvoiceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { invoiceId: string; status: InvoiceStatus }) =>
    z.object({ invoiceId: z.string().uuid(), status: z.enum(INVOICE_STATUSES) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("invoices").update({ status: data.status }).eq("id", data.invoiceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------- Terms upsert ---------- */

const tierSchema = z.object({
  upToCtcInr: z.number().nonnegative(),
  flatFeeInr: z.number().nonnegative(),
});

const upsertTermsSchema = z.object({
  clientId: z.string().uuid(),
  fee_model: z.enum(FEE_MODELS),
  fee_value: z.number().nonnegative(),
  tiers: z.array(tierSchema).max(20).default([]),
  replacement_window_days: z.number().int().min(0).max(365),
  replacement_policy: z.enum(REPLACEMENT_POLICIES),
  billing_cycle: z.enum(BILLING_CYCLES),
  invoice_day_of_month: z.number().int().min(1).max(28),
  payment_terms_days: z.number().int().min(0).max(180),
  gst_pct: z.number().min(0).max(50),
  tds_pct: z.number().min(0).max(50),
  currency: z.string().min(3).max(8).default("INR"),
  po_required: z.boolean(),
  po_number: z.string().max(64).nullable().optional(),
});

export const upsertBillingTerms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof upsertTermsSchema>) => upsertTermsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { clientId, ...rest } = data;
    const payload = {
      client_id: clientId,
      ...rest,
      tiers: rest.tiers ?? [],
      po_number: rest.po_number ?? null,
    };
    const { error } = await supabase
      .from("client_billing_terms")
      .upsert(payload as never, { onConflict: "client_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getClientBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: client }, { data: termsRow }, { data: invs }] = await Promise.all([
      supabase.from("clients").select("id, name").eq("id", data.clientId).maybeSingle(),
      supabase.from("client_billing_terms").select("*").eq("client_id", data.clientId).maybeSingle(),
      supabase.from("invoices").select("*").eq("client_id", data.clientId).order("issue_date", { ascending: false }),
    ]);
    if (!client) return null;
    const terms = termsRow ? termsRowToTyped(termsRow) : defaultTermsFor(data.clientId);
    const cycle = getOpenCycle(terms);

    const preview = await accruedFromPlacements(supabase as unknown as SupaClient, data.clientId, terms, cycle.from, cycle.to);
    const t = totals(preview, terms);

    const { data: joined } = await supabase
      .from("placements")
      .select("id, joining_date, candidate:candidates(name), position:positions(title)")
      .eq("client_id", data.clientId)
      .not("joining_date", "is", null);
    const now = Date.now();
    const guarantees = ((joined ?? []) as RawPlacement[])
      .map((p) => {
        const j = new Date((p.joining_date ?? "") + "T00:00:00Z").getTime();
        const elapsed = Math.floor((now - j) / 86_400_000);
        const remaining = terms.replacement_window_days - elapsed;
        return {
          placement_id: p.id,
          candidate_name: pickName(p.candidate),
          position_title: pickTitle(p.position),
          joining_date: p.joining_date,
          elapsed,
          remaining,
          inWindow: remaining > 0 && elapsed >= 0,
        };
      })
      .filter((g) => g.inWindow);

    return {
      client: client as ClientLite,
      terms,
      cycle: { ...cycle, items: preview, subtotal: t.subtotal, gst: t.gst, tds: t.tds, total: t.total },
      invoices: (invs ?? []) as InvoiceRow[],
      guarantees,
    };
  });

async function _upcomingRuns(supabase: SupaClient) {
  const { data: clients } = await supabase.from("clients").select("id, name, color").order("name", { ascending: true });
  const { data: termsRows } = await supabase.from("client_billing_terms").select("*");
  const termsByClient = new Map<string, BillingTerms>();
  for (const r of (termsRows ?? []) as Record<string, unknown>[]) {
    termsByClient.set(String(r.client_id), termsRowToTyped(r));
  }
  const today = new Date();
  const out: Array<{
    client: { id: string; name: string; color: string | null; initials: string };
    terms: BillingTerms;
    nextRun: string;
    daysAway: number;
    previewTotal: number;
  }> = [];
  for (const c of (clients ?? []) as { id: string; name: string; color: string | null }[]) {
    const terms = termsByClient.get(c.id) ?? defaultTermsFor(c.id);
    const cycle = getOpenCycle(terms, today);
    const items = await accruedFromPlacements(supabase, c.id, terms, cycle.from, cycle.to);
    const t = totals(items, terms);
    const next = nextInvoiceRun(terms, today);
    const daysAway = Math.ceil((new Date(next + "T00:00:00Z").getTime() - today.getTime()) / 86_400_000);
    out.push({
      client: {
        id: c.id,
        name: c.name,
        color: c.color,
        initials: c.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase(),
      },
      terms,
      nextRun: next,
      daysAway,
      previewTotal: t.total,
    });
  }
  return out.sort((a, b) => a.daysAway - b.daysAway);
}

export const upcomingRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => _upcomingRuns(context.supabase as unknown as SupaClient));

export const billingKpis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: invs } = await supabase.from("invoices").select("status, total_inr, issue_date");
    const all = (invs ?? []) as { status: InvoiceStatus; total_inr: number; issue_date: string }[];
    const ym = new Date().toISOString().slice(0, 7);
    const outstanding = all.filter((i) => i.status === "sent" || i.status === "overdue").reduce((a, i) => a + Number(i.total_inr || 0), 0);
    const overdue = all.filter((i) => i.status === "overdue").reduce((a, i) => a + Number(i.total_inr || 0), 0);
    const mtd = all.filter((i) => (i.issue_date ?? "").startsWith(ym)).reduce((a, i) => a + Number(i.total_inr || 0), 0);
    const runs = await _upcomingRuns(supabase as unknown as SupaClient);
    const forecast = runs.reduce((a, r) => a + r.previewTotal, 0);
    return {
      outstandingInr: +outstanding.toFixed(2),
      overdueInr: +overdue.toFixed(2),
      mtdInr: +mtd.toFixed(2),
      forecastInr: +forecast.toFixed(2),
      replacementsActive: 0,
    };
  });

export const generateInvoiceForClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { clientId: string; paymentTermsDays?: number }) =>
    z.object({
      clientId: z.string().uuid(),
      paymentTermsDays: z.number().int().min(0).max(180).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: termsRow } = await supabase.from("client_billing_terms").select("*").eq("client_id", data.clientId).maybeSingle();
    const terms = termsRow ? termsRowToTyped(termsRow) : defaultTermsFor(data.clientId);
    const cycle = getOpenCycle(terms);
    const dueDate =
      typeof data.paymentTermsDays === "number"
        ? isoDate(addDays(new Date(cycle.issueDate + "T00:00:00Z"), data.paymentTermsDays))
        : cycle.dueDate;
    const items = await accruedFromPlacements(supabase as unknown as SupaClient, data.clientId, terms, cycle.from, cycle.to);
    const t = totals(items, terms);
    const { data: client } = await supabase.from("clients").select("name").eq("id", data.clientId).maybeSingle();
    const code = (client?.name ?? "CLT").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "CLT";
    const { count } = await supabase.from("invoices").select("*", { count: "exact", head: true }).eq("client_id", data.clientId);
    const seq = (count ?? 0) + 1;
    const invoiceNo = `EQ/${cycle.issueDate.slice(0, 7).replace("-", "")}/${code}-${String(seq).padStart(3, "0")}`;
    const { data: inv, error } = await supabase
      .from("invoices")
      .insert({
        invoice_no: invoiceNo,
        client_id: data.clientId,
        period_from: cycle.from,
        period_to: cycle.to,
        issue_date: cycle.issueDate,
        due_date: dueDate,
        po_number: terms.po_number,
        subtotal_inr: t.subtotal,
        gst_inr: t.gst,
        tds_inr: t.tds,
        total_inr: t.total,
        status: "draft",
        created_by: userId,
      } as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    if (items.length > 0) {
      const rows = items.map((it) => ({
        invoice_id: inv.id,
        placement_id: it.placement_id,
        candidate_name: it.candidate_name,
        position_title: it.position_title,
        joining_date: it.joining_date,
        ctc_inr: it.ctc_inr,
        fee_basis: it.fee_basis,
        amount_inr: it.amount_inr,
        kind: it.kind,
      }));
      const { error: e2 } = await supabase.from("invoice_line_items").insert(rows as never);
      if (e2) throw new Error(e2.message);
    }
    return inv as InvoiceRow;
  });

/* ---------- Joinings ledger ---------- */

export type JoiningLedgerRow = {
  placement_id: string;
  candidate_name: string;
  initials: string;
  client_id: string;
  client_name: string;
  position_title: string;
  joining_date: string | null;
  ctc_inr: number;
};

export const listJoiningsLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("placements")
      .select("id, joining_date, ctc_inr, client:clients(id,name), candidate:candidates(name), position:positions(title)")
      .order("joining_date", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    type Row = {
      id: string;
      joining_date: string | null;
      ctc_inr: number | null;
      client: { id: string; name: string } | { id: string; name: string }[] | null;
      candidate: { name: string } | { name: string }[] | null;
      position: { title: string } | { title: string }[] | null;
    };
    return ((data ?? []) as Row[]).map((p) => {
      const cli = Array.isArray(p.client) ? p.client[0] : p.client;
      const cand = pickName(p.candidate as RawPlacement["candidate"]);
      return {
        placement_id: p.id,
        candidate_name: cand,
        initials: cand.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase(),
        client_id: cli?.id ?? "",
        client_name: cli?.name ?? "—",
        position_title: pickTitle(p.position as RawPlacement["position"]),
        joining_date: p.joining_date,
        ctc_inr: Number(p.ctc_inr ?? 0),
      } satisfies JoiningLedgerRow;
    });
  });

/* ---------- Pending joinings (need invoice) ---------- */

export type PendingJoiningRow = {
  placement_id: string;
  candidate_name: string;
  client_id: string;
  client_name: string;
  position_title: string;
  joining_date: string | null;
  ctc_inr: number;
  suggested_fee_inr: number;
};

export const listPendingJoinings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("placements")
      .select("id, joining_date, ctc_inr, client_id, invoice_status, client:clients(id,name), candidate:candidates(name), position:positions(title)")
      .not("joining_date", "is", null)
      .in("invoice_status", ["draft"])
      .order("joining_date", { ascending: false });
    if (error) throw new Error(error.message);

    // Load terms map once
    const { data: termsRows } = await supabase.from("client_billing_terms").select("*");
    const termsByClient = new Map<string, BillingTerms>();
    for (const r of (termsRows ?? []) as Record<string, unknown>[]) {
      termsByClient.set(String(r.client_id), termsRowToTyped(r));
    }

    type Row = {
      id: string;
      joining_date: string | null;
      ctc_inr: number | null;
      client_id: string;
      client: { id: string; name: string } | { id: string; name: string }[] | null;
      candidate: { name: string } | { name: string }[] | null;
      position: { title: string } | { title: string }[] | null;
    };
    return ((data ?? []) as Row[]).map((p) => {
      const cli = Array.isArray(p.client) ? p.client[0] : p.client;
      const ctc = Number(p.ctc_inr ?? 0);
      const terms = termsByClient.get(p.client_id) ?? defaultTermsFor(p.client_id);
      const fee = feeForCtc(terms, ctc);
      return {
        placement_id: p.id,
        candidate_name: pickName(p.candidate as RawPlacement["candidate"]),
        client_id: p.client_id,
        client_name: cli?.name ?? "—",
        position_title: pickTitle(p.position as RawPlacement["position"]),
        joining_date: p.joining_date,
        ctc_inr: ctc,
        suggested_fee_inr: fee.amountInr,
      } satisfies PendingJoiningRow;
    });
  });

/* ---------- Client portal reports ---------- */

export const getClientReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: cli } = await supabase.from("clients").select("id").eq("user_id", userId).maybeSingle();
    if (!cli) return null;
    const { data: apps } = await supabase
      .from("applications")
      .select("stage, position:positions!inner(client_id)")
      .eq("position.client_id", cli.id);
    const rows = (apps ?? []) as { stage: string }[];
    const has = (...stages: string[]) => rows.filter((r) => stages.includes(r.stage)).length;
    const shared = has("shared_with_client", "client_shortlist", "interview_scheduled", "rounds", "offered", "closed");
    const shortlisted = has("client_shortlist", "interview_scheduled", "rounds", "offered", "closed");
    const interview = has("interview_scheduled", "rounds", "offered", "closed");
    const offered = has("offered", "closed");
    const { data: placements } = await supabase
      .from("placements")
      .select("joining_date")
      .eq("client_id", cli.id)
      .not("joining_date", "is", null);
    const joined = (placements ?? []).length;
    const months: { month: string; hires: number }[] = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
      const label = d.toLocaleDateString("en-IN", { month: "short" });
      const key = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
      const hires = ((placements ?? []) as { joining_date: string | null }[])
        .filter((p) => (p.joining_date ?? "").startsWith(key)).length;
      months.push({ month: label, hires });
    }
    return { funnel: { shared, shortlisted, interview, offered, joined }, monthlyHires: months };
  });
