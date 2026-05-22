import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Insert = {
  user_id: string;
  kind: "interview_reminder" | "task_sla_breach" | "invoice_overdue" | "system";
  title: string;
  body?: string | null;
  link?: string | null;
  related_interview_id?: string | null;
  related_task_id?: string | null;
  related_invoice_id?: string | null;
  dedup_key: string;
};

async function fanOut(rows: Insert[]) {
  if (rows.length === 0) return 0;
  // Filter dedup
  const keys = rows.map((r) => r.dedup_key);
  const { data: existing } = await supabaseAdmin
    .from("notification_dedup")
    .select("dedup_key")
    .in("dedup_key", keys);
  const seen = new Set((existing ?? []).map((e: any) => e.dedup_key));
  const fresh = rows.filter((r) => !seen.has(r.dedup_key));
  if (fresh.length === 0) return 0;

  const inserts = fresh.map(({ dedup_key, ...rest }) => rest);
  const { error: nErr } = await supabaseAdmin.from("notifications").insert(inserts);
  if (nErr) throw new Error(nErr.message);

  const { error: dErr } = await supabaseAdmin
    .from("notification_dedup")
    .insert(fresh.map((r) => ({ dedup_key: r.dedup_key })));
  if (dErr) throw new Error(dErr.message);

  return fresh.length;
}

async function getAdminUserIds(): Promise<string[]> {
  const { data } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
  return (data ?? []).map((r: any) => r.user_id);
}

async function runInterviewReminders(): Promise<Insert[]> {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const { data: rows } = await supabaseAdmin
    .from("interviews")
    .select("id, scheduled_at, kind, round_index, position_id, candidate_id, created_by, status, candidates(name), positions(title)")
    .gte("scheduled_at", now.toISOString())
    .lte("scheduled_at", in24h.toISOString())
    .neq("status", "cancelled" as any);

  const admins = await getAdminUserIds();
  const out: Insert[] = [];
  for (const iv of rows ?? []) {
    const candidate = (iv as any).candidates?.name ?? "candidate";
    const position = (iv as any).positions?.title ?? "position";
    const when = new Date(iv.scheduled_at!).toLocaleString();
    const title = `Interview in <24h: ${candidate}`;
    const body = `${position} · Round ${iv.round_index} · ${when}`;
    const recipients = new Set<string>(admins);
    if (iv.created_by) recipients.add(iv.created_by);
    for (const uid of recipients) {
      out.push({
        user_id: uid,
        kind: "interview_reminder",
        title,
        body,
        link: `/interviews/${iv.id}`,
        related_interview_id: iv.id,
        dedup_key: `iv24:${iv.id}:${uid}`,
      });
    }
  }
  return out;
}

async function runTaskSlaBreach(): Promise<Insert[]> {
  const nowIso = new Date().toISOString();
  const { data: rows } = await supabaseAdmin
    .from("tasks")
    .select("id, title, due_at, assigned_to, sla, state")
    .lt("due_at", nowIso)
    .neq("state", "Done" as any);

  const admins = await getAdminUserIds();
  const out: Insert[] = [];
  for (const t of rows ?? []) {
    const recipients = new Set<string>(admins);
    if (t.assigned_to) recipients.add(t.assigned_to);
    for (const uid of recipients) {
      out.push({
        user_id: uid,
        kind: "task_sla_breach",
        title: `Task overdue: ${t.title}`,
        body: `Due ${new Date(t.due_at!).toLocaleString()}`,
        link: `/tasks`,
        related_task_id: t.id,
        dedup_key: `task:${t.id}:${uid}`,
      });
    }
  }
  return out;
}

async function runOverdueInvoices(): Promise<Insert[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: rows } = await supabaseAdmin
    .from("invoices")
    .select("id, invoice_no, due_date, total_inr, status, client_id, clients(name)")
    .in("status", ["sent" as any])
    .lt("due_date", today);

  const admins = await getAdminUserIds();
  const out: Insert[] = [];
  for (const inv of rows ?? []) {
    const clientName = (inv as any).clients?.name ?? "client";
    for (const uid of admins) {
      out.push({
        user_id: uid,
        kind: "invoice_overdue",
        title: `Invoice overdue: ${inv.invoice_no}`,
        body: `${clientName} · ₹${Number(inv.total_inr).toLocaleString("en-IN")} · due ${inv.due_date}`,
        link: `/billing/invoices/${inv.id}`,
        related_invoice_id: inv.id,
        dedup_key: `inv:${inv.id}:${uid}:${today}`,
      });
    }
  }
  return out;
}

export const Route = createFileRoute("/api/public/cron")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const [a, b, c] = await Promise.all([
            runInterviewReminders(),
            runTaskSlaBreach(),
            runOverdueInvoices(),
          ]);
          const created = await fanOut([...a, ...b, ...c]);
          return Response.json({ ok: true, created, considered: a.length + b.length + c.length });
        } catch (e: any) {
          console.error("cron error", e);
          return Response.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
        }
      },
      GET: async () => Response.json({ ok: true, hint: "POST to run" }),
    },
  },
});