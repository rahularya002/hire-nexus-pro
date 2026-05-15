import { clients } from "./mock-data";

export type FeeModel = "percent_ctc" | "flat_per_hire" | "tiered";
export type ReplacementPolicy = "free_replacement" | "pro_rata_credit" | "none";
export type BillingCycle = "monthly" | "per_joining";
export type JoiningStatus = "joined" | "replacement_for" | "left_in_window" | "no_show";
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

export interface TierBand { upToCtcLakhs: number; flatFeeLakhs: number }

export interface ClientBillingTerms {
  clientId: string;
  feeModel: FeeModel;
  /** percent for percent_ctc (e.g. 8.33), flat fee in ₹ lakhs for flat_per_hire */
  feeValue: number;
  tiers?: TierBand[];
  replacementWindowDays: number;
  replacementPolicy: ReplacementPolicy;
  billingCycle: BillingCycle;
  /** 1-28 */
  invoiceDayOfMonth: number;
  paymentTermsDays: number;
  gstPct: number;
  tdsPct: number;
  currency: "INR";
  poRequired: boolean;
  poNumber?: string;
}

export interface JoiningEvent {
  id: string;
  clientId: string;
  positionId: string;
  positionTitle: string;
  candidateName: string;
  initials: string;
  ctcLakhs: number;
  offerDate: string;   // ISO yyyy-mm-dd
  joiningDate: string; // ISO yyyy-mm-dd
  status: JoiningStatus;
  replacesEventId?: string;
  notes?: string;
}

export interface InvoiceLineItem {
  eventId: string;
  candidateName: string;
  positionTitle: string;
  joiningDate: string;
  ctcLakhs: number;
  feeBasis: string;      // human readable: "8.33% of ₹26L"
  amountLakhs: number;   // can be negative for credit notes
  kind: "placement" | "replacement_covered" | "credit_left_in_window";
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  clientId: string;
  periodFrom: string;
  periodTo: string;
  issueDate: string;
  dueDate: string;
  poNumber?: string;
  lineItems: InvoiceLineItem[];
  subtotalLakhs: number;
  gstLakhs: number;
  tdsLakhs: number;
  totalLakhs: number;
  status: InvoiceStatus;
}

/* ---------- Seed: per-client custom terms ---------- */

export const billingTerms: ClientBillingTerms[] = [
  { clientId: "razorpay",        feeModel: "percent_ctc",  feeValue: 8.33, replacementWindowDays: 90,  replacementPolicy: "free_replacement", billingCycle: "monthly",     invoiceDayOfMonth: 1,  paymentTermsDays: 30, gstPct: 18, tdsPct: 10, currency: "INR", poRequired: true,  poNumber: "RZP-PO-2026-114" },
  { clientId: "rolex-india",     feeModel: "flat_per_hire", feeValue: 2.0, replacementWindowDays: 120, replacementPolicy: "free_replacement", billingCycle: "per_joining", invoiceDayOfMonth: 5,  paymentTermsDays: 15, gstPct: 18, tdsPct: 10, currency: "INR", poRequired: false },
  { clientId: "tata-digital",    feeModel: "tiered",       feeValue: 0,    tiers: [
      { upToCtcLakhs: 20,  flatFeeLakhs: 1.5 },
      { upToCtcLakhs: 40,  flatFeeLakhs: 3.0 },
      { upToCtcLakhs: 999, flatFeeLakhs: 5.0 },
    ], replacementWindowDays: 90, replacementPolicy: "pro_rata_credit", billingCycle: "monthly", invoiceDayOfMonth: 15, paymentTermsDays: 45, gstPct: 18, tdsPct: 10, currency: "INR", poRequired: true, poNumber: "TD-PO-26-0042" },
  { clientId: "reliance-brands", feeModel: "percent_ctc",  feeValue: 10,   replacementWindowDays: 60,  replacementPolicy: "pro_rata_credit",  billingCycle: "monthly",     invoiceDayOfMonth: 25, paymentTermsDays: 30, gstPct: 18, tdsPct: 10, currency: "INR", poRequired: true,  poNumber: "RB-2026-PO-209" },
  { clientId: "urban-works",     feeModel: "flat_per_hire", feeValue: 1.2, replacementWindowDays: 45,  replacementPolicy: "none",             billingCycle: "per_joining", invoiceDayOfMonth: 10, paymentTermsDays: 30, gstPct: 18, tdsPct: 10, currency: "INR", poRequired: false },
  { clientId: "zomato",          feeModel: "percent_ctc",  feeValue: 8.33, replacementWindowDays: 90,  replacementPolicy: "free_replacement", billingCycle: "monthly",     invoiceDayOfMonth: 7,  paymentTermsDays: 30, gstPct: 18, tdsPct: 10, currency: "INR", poRequired: false },
];

export function getTerms(clientId: string) {
  return billingTerms.find((t) => t.clientId === clientId);
}

/* ---------- Seed: joining events ---------- */

export const joiningEvents: JoiningEvent[] = [
  // Razorpay - monthly, percent
  { id: "je-1",  clientId: "razorpay",        positionId: "p1", positionTitle: "Sr. Product Designer",      candidateName: "Arjun Malhotra",  initials: "AM", ctcLakhs: 32, offerDate: "2026-04-22", joiningDate: "2026-05-06", status: "joined" },
  { id: "je-2",  clientId: "razorpay",        positionId: "p2", positionTitle: "Full Stack Engineer",        candidateName: "Karan Verma",     initials: "KV", ctcLakhs: 28, offerDate: "2026-04-30", joiningDate: "2026-05-12", status: "joined" },
  { id: "je-3",  clientId: "razorpay",        positionId: "p3", positionTitle: "Engineering Manager",        candidateName: "Devika Rao",      initials: "DR", ctcLakhs: 48, offerDate: "2026-03-10", joiningDate: "2026-04-01", status: "joined" },
  { id: "je-4",  clientId: "razorpay",        positionId: "p3", positionTitle: "Engineering Manager",        candidateName: "Aman Shetty",     initials: "AS", ctcLakhs: 46, offerDate: "2026-04-15", joiningDate: "2026-05-02", status: "replacement_for", replacesEventId: "je-3", notes: "Replacement for Devika (left in 28d)" },
  // Rolex India - per joining, flat
  { id: "je-5",  clientId: "rolex-india",     positionId: "p4", positionTitle: "Boutique Manager — Mumbai",  candidateName: "Tara Bhatt",      initials: "TB", ctcLakhs: 18, offerDate: "2026-04-10", joiningDate: "2026-05-03", status: "joined" },
  { id: "je-6",  clientId: "rolex-india",     positionId: "p5", positionTitle: "Watchmaker",                 candidateName: "Sahil Kohli",     initials: "SK", ctcLakhs: 14, offerDate: "2026-04-25", joiningDate: "2026-05-15", status: "joined" },
  // Tata Digital - tiered, monthly, pro-rata
  { id: "je-7",  clientId: "tata-digital",    positionId: "p6", positionTitle: "Engineering Manager",        candidateName: "Sneha Kulkarni",  initials: "SK", ctcLakhs: 38, offerDate: "2026-04-12", joiningDate: "2026-05-04", status: "joined" },
  { id: "je-8",  clientId: "tata-digital",    positionId: "p7", positionTitle: "DevOps Engineer",            candidateName: "Devansh Singh",   initials: "DS", ctcLakhs: 22, offerDate: "2026-03-15", joiningDate: "2026-04-02", status: "left_in_window", notes: "Exited day 41 of 90; pro-rata credit applies" },
  // Reliance Brands - percent, pro-rata, monthly
  { id: "je-9",  clientId: "reliance-brands", positionId: "p8", positionTitle: "Head of E-commerce",         candidateName: "Ishita Banerjee", initials: "IB", ctcLakhs: 55, offerDate: "2026-04-18", joiningDate: "2026-05-08", status: "joined" },
  { id: "je-10", clientId: "reliance-brands", positionId: "p9", positionTitle: "Buyer — Womenswear",         candidateName: "Meera Krishnan",  initials: "MK", ctcLakhs: 26, offerDate: "2026-03-28", joiningDate: "2026-04-15", status: "joined" },
  // Urban Works
  { id: "je-11", clientId: "urban-works",     positionId: "p10", positionTitle: "Community Manager",         candidateName: "Riya Pandey",     initials: "RP", ctcLakhs: 12, offerDate: "2026-04-22", joiningDate: "2026-05-09", status: "joined" },
  // Zomato (forecast — not joined yet, no_show)
  { id: "je-12", clientId: "zomato",          positionId: "p11", positionTitle: "Senior Backend Engineer",   candidateName: "Yash Goel",       initials: "YG", ctcLakhs: 30, offerDate: "2026-04-26", joiningDate: "2026-05-13", status: "no_show", notes: "Did not join — backed out" },
];

/* ---------- Date helpers ---------- */

export const TODAY = new Date("2026-05-15T10:00:00Z");

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function iso(d: Date) { return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`; }
function addDays(d: Date, n: number) { const r = new Date(d); r.setUTCDate(r.getUTCDate()+n); return r; }
function addMonths(d: Date, n: number) { const r = new Date(d); r.setUTCMonth(r.getUTCMonth()+n); return r; }

export function fmtDate(isoStr: string) {
  const d = new Date(isoStr + "T00:00:00Z");
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtINR(lakhs: number) {
  const sign = lakhs < 0 ? "-" : "";
  const v = Math.abs(lakhs);
  if (v >= 100) return `${sign}₹${(v/100).toFixed(2)} Cr`;
  return `${sign}₹${v.toFixed(2)} L`;
}

/* ---------- Cycle / accrual / invoice generation ---------- */

export function getOpenCycle(terms: ClientBillingTerms, today: Date = TODAY) {
  const day = terms.invoiceDayOfMonth;
  const y = today.getUTCFullYear(), m = today.getUTCMonth(), d = today.getUTCDate();
  // cycle ends on day-1 of the invoice month; starts day of previous month
  const periodEnd = d >= day
    ? new Date(Date.UTC(y, m, day - 1))
    : new Date(Date.UTC(y, m - 1, day - 1));
  const periodStart = addDays(addMonths(periodEnd, -1), 1);
  const issue = addDays(periodEnd, 1);
  const due = addDays(issue, terms.paymentTermsDays);
  return { from: iso(periodStart), to: iso(periodEnd), issueDate: iso(issue), dueDate: iso(due) };
}

export function nextInvoiceRun(terms: ClientBillingTerms, today: Date = TODAY) {
  const day = terms.invoiceDayOfMonth;
  const y = today.getUTCFullYear(), m = today.getUTCMonth(), d = today.getUTCDate();
  const next = d < day ? new Date(Date.UTC(y, m, day)) : new Date(Date.UTC(y, m + 1, day));
  return iso(next);
}

export function feeForCtc(terms: ClientBillingTerms, ctcLakhs: number) {
  if (terms.feeModel === "percent_ctc") {
    return { amountLakhs: +(ctcLakhs * (terms.feeValue / 100)).toFixed(2), basis: `${terms.feeValue}% of ${fmtINR(ctcLakhs)}` };
  }
  if (terms.feeModel === "flat_per_hire") {
    return { amountLakhs: terms.feeValue, basis: `Flat ${fmtINR(terms.feeValue)} per hire` };
  }
  // tiered
  const tier = (terms.tiers ?? []).find((t) => ctcLakhs <= t.upToCtcLakhs);
  return { amountLakhs: tier?.flatFeeLakhs ?? 0, basis: `Tier (CTC ≤ ${tier?.upToCtcLakhs}L) → ${fmtINR(tier?.flatFeeLakhs ?? 0)}` };
}

export function eventsForClient(clientId: string) {
  return joiningEvents.filter((e) => e.clientId === clientId);
}

function inRange(dateIso: string, fromIso: string, toIso: string) {
  return dateIso >= fromIso && dateIso <= toIso;
}

export function accruedLineItems(clientId: string, fromIso: string, toIso: string): InvoiceLineItem[] {
  const terms = getTerms(clientId);
  if (!terms) return [];
  const items: InvoiceLineItem[] = [];
  for (const e of eventsForClient(clientId)) {
    if (!inRange(e.joiningDate, fromIso, toIso)) continue;
    if (e.status === "no_show") continue;
    const fee = feeForCtc(terms, e.ctcLakhs);
    if (e.status === "joined") {
      items.push({ eventId: e.id, candidateName: e.candidateName, positionTitle: e.positionTitle, joiningDate: e.joiningDate, ctcLakhs: e.ctcLakhs, feeBasis: fee.basis, amountLakhs: fee.amountLakhs, kind: "placement" });
    } else if (e.status === "replacement_for") {
      const covered = terms.replacementPolicy === "free_replacement";
      items.push({ eventId: e.id, candidateName: e.candidateName, positionTitle: e.positionTitle, joiningDate: e.joiningDate, ctcLakhs: e.ctcLakhs, feeBasis: covered ? `Replacement under ${terms.replacementWindowDays}d guarantee` : fee.basis, amountLakhs: covered ? 0 : fee.amountLakhs, kind: "replacement_covered" });
    } else if (e.status === "left_in_window") {
      if (terms.replacementPolicy === "pro_rata_credit") {
        items.push({ eventId: e.id, candidateName: e.candidateName, positionTitle: e.positionTitle, joiningDate: e.joiningDate, ctcLakhs: e.ctcLakhs, feeBasis: `Pro-rata credit (left in ${terms.replacementWindowDays}d window)`, amountLakhs: -+(fee.amountLakhs * 0.5).toFixed(2), kind: "credit_left_in_window" });
      }
    }
  }
  return items;
}

function totals(items: InvoiceLineItem[], terms: ClientBillingTerms) {
  const subtotal = +items.reduce((a, i) => a + i.amountLakhs, 0).toFixed(2);
  const gst = +(subtotal * (terms.gstPct / 100)).toFixed(2);
  const tds = +(subtotal * (terms.tdsPct / 100)).toFixed(2);
  const total = +(subtotal + gst - tds).toFixed(2);
  return { subtotal, gst, tds, total };
}

/* ---------- Invoice store (mock, reactive) ---------- */

function makeInvoice(clientId: string, opts: { from: string; to: string; issueDate: string; dueDate: string; status: InvoiceStatus; seq: number }): Invoice {
  const terms = getTerms(clientId)!;
  const lineItems = accruedLineItems(clientId, opts.from, opts.to);
  const t = totals(lineItems, terms);
  const code = clientId.slice(0, 3).toUpperCase();
  return {
    id: `inv-${clientId}-${opts.seq}`,
    invoiceNo: `EQ/${opts.issueDate.slice(0,7).replace("-","")}/${code}-${String(opts.seq).padStart(3,"0")}`,
    clientId,
    periodFrom: opts.from,
    periodTo: opts.to,
    issueDate: opts.issueDate,
    dueDate: opts.dueDate,
    poNumber: terms.poNumber,
    lineItems,
    subtotalLakhs: t.subtotal,
    gstLakhs: t.gst,
    tdsLakhs: t.tds,
    totalLakhs: t.total,
    status: opts.status,
  };
}

const invoices: Invoice[] = [
  // A few historical invoices so the UI feels real
  makeInvoice("razorpay",        { from: "2026-03-01", to: "2026-03-31", issueDate: "2026-04-01", dueDate: "2026-05-01", status: "paid",     seq: 1 }),
  makeInvoice("razorpay",        { from: "2026-04-01", to: "2026-04-30", issueDate: "2026-05-01", dueDate: "2026-05-31", status: "sent",     seq: 2 }),
  makeInvoice("rolex-india",     { from: "2026-05-03", to: "2026-05-03", issueDate: "2026-05-04", dueDate: "2026-05-19", status: "sent",     seq: 1 }),
  makeInvoice("tata-digital",    { from: "2026-03-15", to: "2026-04-14", issueDate: "2026-04-15", dueDate: "2026-05-30", status: "overdue",  seq: 1 }),
  makeInvoice("reliance-brands", { from: "2026-03-25", to: "2026-04-24", issueDate: "2026-04-25", dueDate: "2026-05-25", status: "sent",     seq: 1 }),
];

let version = 0;
const listeners = new Set<() => void>();
export function subscribeBilling(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }
export function getBillingVersion() { return version; }
function notify() { version++; listeners.forEach((l) => l()); }

export function listInvoices(): Invoice[] { return invoices.slice(); }
export function invoicesForClient(clientId: string) { return invoices.filter((i) => i.clientId === clientId); }
export function getInvoice(id: string) { return invoices.find((i) => i.id === id); }

export function setInvoiceStatus(id: string, status: InvoiceStatus) {
  const inv = invoices.find((i) => i.id === id);
  if (!inv || inv.status === status) return;
  inv.status = status;
  notify();
}

export function previewCurrentCycle(clientId: string) {
  const terms = getTerms(clientId);
  if (!terms) return null;
  const cy = getOpenCycle(terms);
  const items = accruedLineItems(clientId, cy.from, cy.to);
  const t = totals(items, terms);
  return { ...cy, items, ...t, terms };
}

export function activeReplacementWindow(clientId: string) {
  const terms = getTerms(clientId);
  if (!terms) return [];
  const today = TODAY.getTime();
  return eventsForClient(clientId)
    .filter((e) => e.status === "joined")
    .map((e) => {
      const join = new Date(e.joiningDate + "T00:00:00Z").getTime();
      const elapsed = Math.floor((today - join) / 86400000);
      const remaining = terms.replacementWindowDays - elapsed;
      return { event: e, elapsed, remaining, inWindow: remaining > 0 };
    })
    .filter((r) => r.inWindow);
}

/* ---------- Aggregates for dashboard KPIs ---------- */

export function billingKpis() {
  const all = listInvoices();
  const outstanding = all.filter((i) => i.status === "sent" || i.status === "overdue").reduce((a, i) => a + i.totalLakhs, 0);
  const overdue = all.filter((i) => i.status === "overdue").reduce((a, i) => a + i.totalLakhs, 0);
  const mtd = all.filter((i) => i.issueDate.slice(0,7) === iso(TODAY).slice(0,7)).reduce((a, i) => a + i.totalLakhs, 0);
  const forecast = clients.reduce((a, c) => {
    const p = previewCurrentCycle(c.id);
    return a + (p?.total ?? 0);
  }, 0);
  const replacementsActive = clients.reduce((a, c) => a + activeReplacementWindow(c.id).length, 0);
  return {
    outstandingLakhs: +outstanding.toFixed(2),
    overdueLakhs: +overdue.toFixed(2),
    mtdLakhs: +mtd.toFixed(2),
    forecastLakhs: +forecast.toFixed(2),
    replacementsActive,
  };
}

export function upcomingRuns() {
  return clients
    .map((c) => {
      const terms = getTerms(c.id);
      if (!terms) return null;
      const next = nextInvoiceRun(terms);
      const preview = previewCurrentCycle(c.id);
      const daysAway = Math.ceil((new Date(next + "T00:00:00Z").getTime() - TODAY.getTime()) / 86400000);
      return { client: c, terms, nextRun: next, daysAway, preview };
    })
    .filter(Boolean)
    .sort((a, b) => (a!.daysAway - b!.daysAway)) as Array<{ client: typeof clients[number]; terms: ClientBillingTerms; nextRun: string; daysAway: number; preview: ReturnType<typeof previewCurrentCycle> }>;
}

export function clientName(id: string) { return clients.find((c) => c.id === id)?.name ?? id; }
export function clientInitials(id: string) { return clients.find((c) => c.id === id)?.initials ?? "—"; }
export function clientColor(id: string) { return clients.find((c) => c.id === id)?.color ?? "oklch(0.6 0.1 250)"; }