import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const INTERVIEW_STATUSES = [
  "pending_confirmation",
  "confirmed",
  "reschedule_requested",
  "completed",
  "no_show",
  "cancelled",
] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

export const INTERVIEW_STATUS_LABEL: Record<InterviewStatus, string> = {
  pending_confirmation: "Pending confirmation",
  confirmed: "Confirmed",
  reschedule_requested: "Reschedule requested",
  completed: "Completed",
  no_show: "No-show",
  cancelled: "Cancelled",
};

export const INTERVIEW_PROVIDERS = [
  "google_meet",
  "microsoft_teams",
  "zoom",
  "on_site",
  "phone",
] as const;
export type InterviewProvider = (typeof INTERVIEW_PROVIDERS)[number];

export const INTERVIEW_PROVIDER_LABEL: Record<InterviewProvider, string> = {
  google_meet: "Google Meet",
  microsoft_teams: "Microsoft Teams",
  zoom: "Zoom",
  on_site: "Offline / In-person",
  phone: "Phone",
};

export const INTERVIEW_KINDS = [
  "hr_screen",
  "technical",
  "hiring_manager",
  "panel",
  "ceo",
  "culture_fit",
  "case_study",
] as const;
export type InterviewKind = (typeof INTERVIEW_KINDS)[number];

export const INTERVIEW_KIND_LABEL: Record<InterviewKind, string> = {
  hr_screen: "HR Screen",
  technical: "Technical",
  hiring_manager: "Hiring Manager",
  panel: "Panel",
  ceo: "CEO",
  culture_fit: "Culture Fit",
  case_study: "Case Study",
};

export const INVOICE_STATUSES = ["draft", "sent", "paid", "overdue"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INTERVIEW_CONDUCTORS = ["recruiter", "client"] as const;
export type InterviewConductor = (typeof INTERVIEW_CONDUCTORS)[number];

export const INTERVIEW_CONDUCTOR_LABEL: Record<InterviewConductor, string> = {
  recruiter: "Recruiter",
  client: "Client",
};

export type InterviewRow = {
  id: string;
  application_id: string;
  candidate_id: string;
  position_id: string;
  round_index: number;
  kind: InterviewKind;
  custom_kind_label: string | null;
  conducted_by: InterviewConductor;
  interviewer: string | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  status: InterviewStatus;
  provider: InterviewProvider;
  meeting_link: string | null;
  location: string | null;
  notes: string | null;
  cv_attached: boolean;
  recruiter_reminder: boolean;
  candidate_reminder: boolean;
  created_at: string;
  updated_at: string;
  candidate?: { id: string; name: string; role: string | null } | null;
  position?: {
    id: string;
    title: string;
    client_id: string;
    client?: { id: string; name: string; color: string | null } | null;
  } | null;
  application?: { id: string; stage: string } | null;
};

export type PlacementRow = {
  id: string;
  application_id: string;
  candidate_id: string;
  position_id: string;
  client_id: string;
  ctc_inr: number | null;
  ctc_display: string | null;
  offer_date: string | null;
  joining_date: string | null;
  guarantee_window_days: number;
  invoice_status: InvoiceStatus;
  invoice_amount_inr: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  candidate?: { id: string; name: string } | null;
  position?: { id: string; title: string; client_id: string } | null;
  client?: { id: string; name: string } | null;
};

function clean<T extends Record<string, any>>(o: T): T {
  const out: any = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === "" || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

async function logActivity(
  supabase: any,
  userId: string,
  payload: {
    kind: string;
    title: string;
    detail?: string | null;
    client_id?: string | null;
    position_id?: string | null;
    candidate_id?: string | null;
    application_id?: string | null;
    client_visible?: boolean;
  },
) {
  try {
    const { getUserAgencyId } = await import("@/lib/auth/agency");
    const agencyId = await getUserAgencyId(supabase, userId);
    if (!agencyId) return;
    const clean_payload: any = { ...payload, actor_id: userId, agency_id: agencyId };
    for (const k of Object.keys(clean_payload)) {
      if (clean_payload[k] === "" || clean_payload[k] === undefined) delete clean_payload[k];
    }
    await supabase.from("activities").insert(clean_payload);
  } catch {
    /* never throw from logging */
  }
}

/**
 * Best-effort Google Meet sync. Creates or updates a Google Calendar event
 * (with Meet link) on the acting recruiter's calendar when:
 *  - provider is google_meet
 *  - scheduled_at is set
 *  - the recruiter has connected Google Calendar
 * Updates interviews.meeting_link / external_event_id on success.
 * Swallows errors so interview saves never fail because of Google.
 */
async function syncGoogleMeet(userId: string, interviewId: string) {
  try {
    const { getValidAccessToken, createCalendarEvent, patchCalendarEvent } =
      await import("./google-calendar.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("interviews")
      .select(
        "id, provider, scheduled_at, duration_minutes, interviewer, notes, round_index, external_event_id, meeting_link, candidate:candidates(name,email), position:positions(title, client:clients(name))",
      )
      .eq("id", interviewId)
      .maybeSingle();
    if (!row) return;
    if (row.provider !== "google_meet" || !row.scheduled_at) return;

    // If someone pasted a manual link (no calendar event we own), don't overwrite it.
    // But if we previously created a calendar event, keep syncing it on reschedules.
    if ((row as any).meeting_link && !row.external_event_id) return;

    const conn = await getValidAccessToken(userId);
    if (!conn) return; // recruiter hasn't connected

    const candidateName = (row as any).candidate?.name ?? "Candidate";
    const candidateEmail = (row as any).candidate?.email ?? null;
    const positionTitle = (row as any).position?.title ?? "Interview";
    const clientName = (row as any).position?.client?.name ?? "";
    const summary = `${clientName ? clientName + " · " : ""}${positionTitle} · ${candidateName} (R${row.round_index})`;
    const description = [row.interviewer ? `Interviewer: ${row.interviewer}` : null, row.notes ?? null]
      .filter(Boolean)
      .join("\n\n");
    const attendees: { email: string }[] = [];
    if (candidateEmail) attendees.push({ email: candidateEmail });

    const args = {
      summary,
      description,
      startISO: row.scheduled_at,
      durationMinutes: row.duration_minutes ?? 45,
      attendees,
      createMeet: true,
    };

    if (row.external_event_id) {
      try {
        await patchCalendarEvent(conn.access_token, row.external_event_id, args);
        return;
      } catch {
        // fall through to create a fresh event
      }
    }
    const ev = await createCalendarEvent(conn.access_token, args);
    await supabaseAdmin
      .from("interviews")
      .update({
        external_event_id: ev.id,
        external_provider: "google_calendar",
        meeting_link: ev.hangoutLink ?? null,
      })
      .eq("id", interviewId);
  } catch (e) {
    console.error("[google-meet sync] failed:", (e as Error).message);
  }
}

const INTERVIEW_SELECT =
  "*, candidate:candidates(id,name,role), position:positions(id,title,client_id, client:clients(id,name,color)), application:applications(id,stage)";

/* ---------------- Interviews ---------------- */

export const listInterviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        applicationId: z.string().uuid().optional(),
        positionId: z.string().uuid().optional(),
        scope: z.enum(["today", "upcoming", "past", "all"]).optional(),
      })
      .optional()
      .parse(d) ?? {},
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("interviews")
      .select(INTERVIEW_SELECT)
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(1000);
    if (data?.applicationId) q = q.eq("application_id", data.applicationId);
    if (data?.positionId) q = q.eq("position_id", data.positionId);
    if (data?.scope && data.scope !== "all") {
      const now = new Date();
      const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
      const endToday = new Date(now); endToday.setHours(23, 59, 59, 999);
      if (data.scope === "today") {
        q = q.gte("scheduled_at", startToday.toISOString()).lte("scheduled_at", endToday.toISOString());
      } else if (data.scope === "upcoming") {
        q = q.gt("scheduled_at", endToday.toISOString());
      } else if (data.scope === "past") {
        q = q.lt("scheduled_at", startToday.toISOString());
      }
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as InterviewRow[];
  });

export const getInterviewProcess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { applicationId: string }) =>
    z.object({ applicationId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: app, error: appErr } = await supabase
      .from("applications")
      .select(
        "id, stage, candidate:candidates(id,name,role,email,location), position:positions(id,title,client_id, client:clients(id,name,color))",
      )
      .eq("id", data.applicationId)
      .maybeSingle();
    if (appErr) throw new Error(appErr.message);
    if (!app) return null;
    const { data: rounds, error: rErr } = await supabase
      .from("interviews")
      .select(INTERVIEW_SELECT)
      .eq("application_id", data.applicationId)
      .order("round_index", { ascending: true });
    if (rErr) throw new Error(rErr.message);
    return { application: app, rounds: (rounds ?? []) as InterviewRow[] };
  });

const interviewSchema = z.object({
  application_id: z.string().uuid(),
  candidate_id: z.string().uuid(),
  position_id: z.string().uuid(),
  round_index: z.number().int().min(1).max(20).optional(),
  kind: z.enum(INTERVIEW_KINDS).optional(),
  custom_kind_label: z.string().max(120).optional().nullable(),
  conducted_by: z.enum(INTERVIEW_CONDUCTORS).optional(),
  interviewer: z.string().max(200).optional().nullable(),
  scheduled_at: z.string().datetime().optional().nullable(),
  duration_minutes: z.number().int().min(5).max(600).optional().nullable(),
  status: z.enum(INTERVIEW_STATUSES).optional(),
  provider: z.enum(INTERVIEW_PROVIDERS).optional(),
  meeting_link: z.string().max(500).optional().nullable(),
  location: z.string().max(300).optional().nullable(),
  notes: z.string().max(10_000).optional().nullable(),
  cv_attached: z.boolean().optional(),
  recruiter_reminder: z.boolean().optional(),
  candidate_reminder: z.boolean().optional(),
});

export const createInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => interviewSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("interviews")
      .insert(clean({ ...data, created_by: userId }) as never)
      .select(INTERVIEW_SELECT)
      .single();
    if (error) throw new Error(error.message);
    await logActivity(supabase, userId, {
      kind: "interview_scheduled",
      title: `Interview scheduled${row.candidate?.name ? ` · ${row.candidate.name}` : ""}`,
      detail: row.position?.title ?? null,
      application_id: row.application_id,
      candidate_id: row.candidate_id,
      position_id: row.position_id,
      client_id: row.position?.client_id ?? null,
      client_visible: true,
    });
    await syncGoogleMeet(userId, row.id);
    const { data: refreshed } = await supabase
      .from("interviews").select(INTERVIEW_SELECT).eq("id", row.id).single();
    return (refreshed ?? row) as InterviewRow;
  });

export const updateInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid() }).merge(interviewSchema.partial()).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...rest } = data;
    const { data: row, error } = await supabase
      .from("interviews")
      .update(clean(rest))
      .eq("id", id)
      .select(INTERVIEW_SELECT)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Interview not found or not accessible");
    if (data.status) {
      const kind =
        data.status === "completed" ? "interview_completed"
        : data.status === "cancelled" || data.status === "no_show" ? "stage_change"
        : "interview_scheduled";
      await logActivity(supabase, userId, {
        kind,
        title: `Interview ${INTERVIEW_STATUS_LABEL[data.status]}${row.candidate?.name ? ` · ${row.candidate.name}` : ""}`,
        detail: row.position?.title ?? null,
        application_id: row.application_id,
        candidate_id: row.candidate_id,
        position_id: row.position_id,
        client_id: row.position?.client_id ?? null,
        client_visible: true,
      });
    } else if (data.scheduled_at) {
      await logActivity(supabase, userId, {
        kind: "interview_scheduled",
        title: `Interview rescheduled${row.candidate?.name ? ` · ${row.candidate.name}` : ""}`,
        detail: row.position?.title ?? null,
        application_id: row.application_id,
        candidate_id: row.candidate_id,
        position_id: row.position_id,
        client_id: row.position?.client_id ?? null,
        client_visible: true,
      });
    }
    if (data.scheduled_at || data.provider === "google_meet") {
      await syncGoogleMeet(userId, row.id);
      const { data: refreshed } = await supabase
        .from("interviews").select(INTERVIEW_SELECT).eq("id", row.id).single();
      return (refreshed ?? row) as InterviewRow;
    }
    return row as InterviewRow;
  });

export const deleteInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("interviews").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Backfill Meet links after connecting Google ---------------- */

export const resyncPendingInterviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const nowIso = new Date().toISOString();
    // RLS-scoped read: caller only sees interviews they can access.
    const { data: rows, error } = await supabase
      .from("interviews")
      .select("id")
      .eq("provider", "google_meet")
      .is("meeting_link", null)
      .gte("scheduled_at", nowIso)
      .limit(50);
    if (error) throw new Error(error.message);
    let synced = 0;
    for (const r of rows ?? []) {
      await syncGoogleMeet(userId, r.id);
      synced++;
    }
    return { synced };
  });

/* ---------------- Client-facing interview request ---------------- */

export const requestClientInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        application_id: z.string().uuid(),
        scheduled_at: z.string().datetime(),
        provider: z.enum(INTERVIEW_PROVIDERS).optional(),
        location: z.string().max(300).optional().nullable(),
        meeting_link: z.string().url().max(500).optional().nullable(),
        rounds: z
          .array(
            z.object({
              kind: z.enum(INTERVIEW_KINDS),
              custom_kind_label: z.string().max(120).nullable().optional(),
              interviewer: z.string().max(200).nullable().optional(),
            }),
          )
          .min(1)
          .max(10),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Verify client owns the application's position (via RLS-scoped read)
    const { data: app, error: appErr } = await supabase
      .from("applications")
      .select("id, candidate_id, position_id, position:positions(id,title,client_id)")
      .eq("id", data.application_id)
      .maybeSingle();
    if (appErr) throw new Error(appErr.message);
    if (!app) throw new Error("Application not found or not accessible");

    // Admin-client writes (clients aren't in the staff insert RLS for interviews)
    const rows = data.rounds.map((r, i) => ({
      application_id: app.id,
      candidate_id: app.candidate_id,
      position_id: app.position_id,
      round_index: i + 1,
      kind: r.kind,
      custom_kind_label: r.custom_kind_label?.trim() || null,
      interviewer: r.interviewer?.trim() || null,
      conducted_by: "client" as const,
      scheduled_at: i === 0 ? data.scheduled_at : null,
      status: "pending_confirmation" as const,
      provider: (data.provider ?? "google_meet") as InterviewProvider,
      location: data.provider === "on_site" && i === 0 ? (data.location?.trim() || null) : null,
      meeting_link: i === 0 ? (data.meeting_link?.trim() || null) : null,
      created_by: userId,
    }));
    // Service-role insert: stamp agency_id from the parent application
    const { data: parentApp } = await supabaseAdmin
      .from("applications")
      .select("agency_id")
      .eq("id", app.id)
      .maybeSingle();
    const parentAgency = parentApp?.agency_id;
    if (!parentAgency) throw new Error("Application has no agency owner");
    const rowsWithAgency = rows.map((r) => ({ ...r, agency_id: parentAgency }));
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("interviews")
      .insert(rowsWithAgency as never)
      .select("id, round_index, provider, scheduled_at");
    if (insErr) throw new Error(insErr.message);

    const { error: updErr } = await supabaseAdmin
      .from("applications")
      .update({ stage: "interview_scheduled" })
      .eq("id", app.id);
    if (updErr) throw new Error(updErr.message);

    // For Google Meet requests, mint a Calendar event on the client's connected
    // Google account so the candidate is auto-emailed an invite + Meet link.
    const firstRound = (inserted ?? []).find((r: any) => r.round_index === 1);
    if (firstRound && firstRound.provider === "google_meet" && firstRound.scheduled_at) {
      await syncGoogleMeet(userId, firstRound.id);
    }

    await logActivity(supabaseAdmin, userId, {
      kind: "interview_scheduled",
      title: `Client requested interview · ${data.rounds.length} round${data.rounds.length > 1 ? "s" : ""}`,
      detail: app.position?.title ?? null,
      application_id: app.id,
      candidate_id: app.candidate_id,
      position_id: app.position_id,
      client_id: app.position?.client_id ?? null,
      client_visible: true,
    });
    return { ok: true };
  });

/* ---------------- Placements ---------------- */

const PLACEMENT_SELECT =
  "*, candidate:candidates(id,name), position:positions(id,title,client_id), client:clients(id,name)";

export const listPlacements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ clientId: z.string().uuid().optional() })
      .optional()
      .parse(d) ?? {},
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("placements")
      .select(PLACEMENT_SELECT)
      .order("joining_date", { ascending: false, nullsFirst: false })
      .limit(500);
    if (data?.clientId) q = q.eq("client_id", data.clientId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as PlacementRow[];
  });

const placementSchema = z.object({
  application_id: z.string().uuid(),
  candidate_id: z.string().uuid(),
  position_id: z.string().uuid(),
  client_id: z.string().uuid(),
  ctc_inr: z.number().min(0).max(1e12).optional().nullable(),
  ctc_display: z.string().max(50).optional().nullable(),
  offer_date: z.string().date().optional().nullable(),
  joining_date: z.string().date().optional().nullable(),
  guarantee_window_days: z.number().int().min(0).max(365).optional(),
  invoice_status: z.enum(INVOICE_STATUSES).optional(),
  invoice_amount_inr: z.number().min(0).max(1e12).optional().nullable(),
  notes: z.string().max(10_000).optional().nullable(),
});

export const createPlacement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => placementSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("placements")
      .insert(clean({ ...data, created_by: userId }) as never)
      .select(PLACEMENT_SELECT)
      .single();
    if (error) throw new Error(error.message);
    await logActivity(supabase, userId, {
      kind: "offer",
      title: `Placement created${row.candidate?.name ? ` · ${row.candidate.name}` : ""}`,
      detail: row.position?.title ?? row.ctc_display ?? null,
      application_id: row.application_id,
      candidate_id: row.candidate_id,
      position_id: row.position_id,
      client_id: row.client_id,
      client_visible: true,
    });
    return row as PlacementRow;
  });

export const updatePlacement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid() }).merge(placementSchema.partial()).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, ...rest } = data;
    const { data: row, error } = await supabase
      .from("placements")
      .update(clean(rest))
      .eq("id", id)
      .select(PLACEMENT_SELECT)
      .single();
    if (error) throw new Error(error.message);
    return row as PlacementRow;
  });

export const deletePlacement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("placements").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Helpers ---------------- */

export function formatInterviewWhen(iso: string | null): string {
  if (!iso) return "TBD";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today · ${time}`;
  if (isTomorrow) return `Tomorrow · ${time}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} · ${time}`;
}

export function interviewRoundLabel(r: Pick<InterviewRow, "kind" | "custom_kind_label">): string {
  return (r.custom_kind_label && r.custom_kind_label.trim()) || INTERVIEW_KIND_LABEL[r.kind];
}

/* ---------------- Client post-interview decision ---------------- */

export const INTERVIEW_DECISIONS = ["select", "reject", "next_round"] as const;
export type InterviewDecision = (typeof INTERVIEW_DECISIONS)[number];

const DECISION_TO_STAGE: Record<InterviewDecision, "offered" | "client_rejected" | "interview_scheduled"> = {
  select: "offered",
  reject: "client_rejected",
  next_round: "interview_scheduled",
};

const DECISION_LABEL: Record<InterviewDecision, string> = {
  select: "Client selected candidate",
  reject: "Client rejected candidate",
  next_round: "Client requested another round",
};

export const recordInterviewDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        applicationId: z.string().uuid(),
        decision: z.enum(INTERVIEW_DECISIONS),
        note: z.string().trim().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: app, error: appErr } = await supabase
      .from("applications")
      .select("id, candidate_id, position_id, position:positions(id, client_id)")
      .eq("id", data.applicationId)
      .maybeSingle();
    if (appErr) throw new Error(appErr.message);
    if (!app) throw new Error("Application not found.");

    const stage = DECISION_TO_STAGE[data.decision];
    const { error: updErr } = await supabase
      .from("applications")
      .update({ stage })
      .eq("id", data.applicationId);
    if (updErr) throw new Error(updErr.message);

    await logActivity(supabase, userId, {
      kind: "stage_change",
      title: DECISION_LABEL[data.decision],
      detail: data.note?.trim() || null,
      client_id: (app.position as any)?.client_id ?? null,
      position_id: app.position_id,
      candidate_id: app.candidate_id,
      application_id: app.id,
      client_visible: true,
    });

    if (data.note && data.note.trim()) {
      await logActivity(supabase, userId, {
        kind: "note",
        title: "Interview feedback",
        detail: data.note.trim(),
        client_id: (app.position as any)?.client_id ?? null,
        position_id: app.position_id,
        candidate_id: app.candidate_id,
        application_id: app.id,
        client_visible: true,
      });
    }

    return { ok: true, stage };
  });

/* ---------------- Client-initiated placement (post-select "candidate joined") ---------------- */

export const createClientPlacement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        application_id: z.string().uuid(),
        offer_date: z.string().date().optional().nullable(),
        joining_date: z.string().date(),
        ctc_display: z.string().max(50).optional().nullable(),
        ctc_inr: z.number().min(0).max(1e12).optional().nullable(),
        notes: z.string().max(2000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // RLS-scoped read verifies caller can see this application (client team member or agency staff).
    const { data: app, error: appErr } = await supabase
      .from("applications")
      .select("id, candidate_id, position_id, position:positions(id,title,client_id)")
      .eq("id", data.application_id)
      .maybeSingle();
    if (appErr) throw new Error(appErr.message);
    if (!app) throw new Error("Application not found or not accessible");

    const clientId = (app.position as any)?.client_id as string | undefined;
    if (!clientId) throw new Error("Position has no client");

    // Prevent duplicates.
    const { data: existing } = await supabaseAdmin
      .from("placements")
      .select("id")
      .eq("application_id", app.id)
      .maybeSingle();
    if (existing) throw new Error("Placement already recorded for this candidate");

    // Stamp agency + seed guarantee window from client billing terms.
    const { data: parentApp } = await supabaseAdmin
      .from("applications")
      .select("agency_id")
      .eq("id", app.id)
      .maybeSingle();
    const agencyId = parentApp?.agency_id;
    if (!agencyId) throw new Error("Application has no agency owner");

    const { data: terms } = await supabaseAdmin
      .from("client_billing_terms")
      .select("replacement_window_days")
      .eq("client_id", clientId)
      .maybeSingle();
    const guaranteeWindow = Number(terms?.replacement_window_days ?? 90);

    const insertRow = clean({
      application_id: app.id,
      candidate_id: app.candidate_id,
      position_id: app.position_id,
      client_id: clientId,
      agency_id: agencyId,
      offer_date: data.offer_date ?? null,
      joining_date: data.joining_date,
      ctc_display: data.ctc_display?.trim() || null,
      ctc_inr: data.ctc_inr ?? null,
      guarantee_window_days: guaranteeWindow,
      invoice_status: "draft" as const,
      notes: data.notes?.trim() || null,
      created_by: userId,
    });

    const { data: row, error: insErr } = await supabaseAdmin
      .from("placements")
      .insert(insertRow as never)
      .select(PLACEMENT_SELECT)
      .single();
    if (insErr) throw new Error(insErr.message);

    // Close the application; trigger notify_agency_on_joining fires from joining_date being set.
    await supabaseAdmin
      .from("applications")
      .update({ stage: "closed" })
      .eq("id", app.id);

    // Close the position as well — a candidate joining fills the mandate.
    await supabaseAdmin
      .from("positions")
      .update({ status: "closed" })
      .eq("id", app.position_id);

    await logActivity(supabaseAdmin, userId, {
      kind: "offer",
      title: `Candidate joined${row.candidate?.name ? ` · ${row.candidate.name}` : ""}`,
      detail: `${row.position?.title ?? ""} · joining ${data.joining_date}`.trim(),
      application_id: app.id,
      candidate_id: app.candidate_id,
      position_id: app.position_id,
      client_id: clientId,
      client_visible: true,
    });

    return row as PlacementRow;
  });

/* ---------------- Applications pending a placement record ---------------- */

export type PendingPlacementRow = {
  application_id: string;
  candidate_id: string;
  candidate_name: string | null;
  position_id: string;
  position_title: string | null;
  client_id: string | null;
  client_name: string | null;
  offered_at: string | null;
};

export const listPendingPlacements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: apps, error } = await supabase
      .from("applications")
      .select(
        "id, candidate_id, position_id, updated_at, candidate:candidates(id,name), position:positions(id,title,client_id,client:clients(id,name))",
      )
      .eq("stage", "offered")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const ids = (apps ?? []).map((a: any) => a.id);
    if (ids.length === 0) return [] as PendingPlacementRow[];
    // Filter out any that already have a placement row (RLS-scoped read).
    const { data: existing } = await supabase
      .from("placements")
      .select("application_id")
      .in("application_id", ids);
    const taken = new Set((existing ?? []).map((r: any) => r.application_id));
    return (apps ?? [])
      .filter((a: any) => !taken.has(a.id))
      .map((a: any) => ({
        application_id: a.id,
        candidate_id: a.candidate_id,
        candidate_name: a.candidate?.name ?? null,
        position_id: a.position_id,
        position_title: a.position?.title ?? null,
        client_id: a.position?.client_id ?? null,
        client_name: a.position?.client?.name ?? null,
        offered_at: a.updated_at ?? null,
      })) as PendingPlacementRow[];
  });