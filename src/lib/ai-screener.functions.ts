import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type ScreenerRow = {
  positionId: string;
  enabled: boolean;
  jobPitch: string;
  askNoticeCtc: boolean;
  askLocation: boolean;
  askSkills: boolean;
};

function defaultPitch(p: {
  title: string;
  location: string | null;
  experience: string | null;
  client_name?: string | null;
}) {
  const loc = p.location ? ` in ${p.location}` : "";
  const exp = p.experience ? ` with ${p.experience} of experience` : "";
  const client = p.client_name ? ` for ${p.client_name}` : "";
  return `Hello! This is a call from our hiring team. We're looking for a ${p.title}${client}${loc}${exp}. Would you have a couple of minutes to chat about the role?`;
}

export const getScreenerForPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ positionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: pos, error: posErr } = await supabase
      .from("positions")
      .select("id, title, location, experience, skills, agency_id, client:clients(name)")
      .eq("id", data.positionId)
      .maybeSingle();
    if (posErr) throw new Error(posErr.message);
    if (!pos) throw new Error("Position not found");

    const { data: row, error } = await supabase
      .from("position_ai_screeners")
      .select("*")
      .eq("position_id", data.positionId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const clientName = (pos as { client?: { name?: string | null } | null }).client?.name ?? null;
    const seededPitch = defaultPitch({
      title: pos.title,
      location: pos.location,
      experience: pos.experience,
      client_name: clientName,
    });

    return {
      positionId: data.positionId,
      agencyId: pos.agency_id as string,
      title: pos.title as string,
      skills: (pos.skills ?? []) as string[],
      location: (pos.location ?? "") as string,
      experience: (pos.experience ?? "") as string,
      clientName,
      screener: row
        ? {
            enabled: !!row.enabled,
            jobPitch: row.job_pitch || seededPitch,
            askNoticeCtc: !!row.ask_notice_ctc,
            askLocation: !!row.ask_location,
            askSkills: !!row.ask_skills,
          }
        : {
            enabled: false,
            jobPitch: seededPitch,
            askNoticeCtc: true,
            askLocation: true,
            askSkills: true,
          },
    };
  });

export const saveScreener = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        positionId: z.string().uuid(),
        enabled: z.boolean(),
        jobPitch: z.string().max(4000),
        askNoticeCtc: z.boolean(),
        askLocation: z.boolean(),
        askSkills: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: pos, error: posErr } = await supabase
      .from("positions")
      .select("agency_id")
      .eq("id", data.positionId)
      .maybeSingle();
    if (posErr) throw new Error(posErr.message);
    if (!pos) throw new Error("Position not found");

    const { error } = await supabase
      .from("position_ai_screeners")
      .upsert(
        {
          position_id: data.positionId,
          agency_id: pos.agency_id,
          enabled: data.enabled,
          job_pitch: data.jobPitch,
          ask_notice_ctc: data.askNoticeCtc,
          ask_location: data.askLocation,
          ask_skills: data.askSkills,
          created_by: userId,
        },
        { onConflict: "position_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createTestCallToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ positionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const agentId = process.env.ELEVENLABS_SCREENER_AGENT_ID;
    if (!apiKey) throw new Error("ElevenLabs is not connected. Ask an admin to link ElevenLabs in Connectors.");
    if (!agentId) throw new Error("Missing ELEVENLABS_SCREENER_AGENT_ID secret. Create a Conversational AI agent in ElevenLabs and save its ID.");

    // Verify caller can access this position (RLS on select).
    const { data: pos, error: posErr } = await supabase
      .from("positions")
      .select("id, title, skills, location, experience, client:clients(name)")
      .eq("id", data.positionId)
      .maybeSingle();
    if (posErr) throw new Error(posErr.message);
    if (!pos) throw new Error("Position not found");

    const { data: row } = await supabase
      .from("position_ai_screeners")
      .select("*")
      .eq("position_id", data.positionId)
      .maybeSingle();

    const skills = ((pos.skills ?? []) as string[]).slice(0, 8);
    const questions: string[] = [];
    if (!row || row.ask_notice_ctc) questions.push("current notice period and current CTC (compensation)");
    if (!row || row.ask_location) questions.push(`willingness to work in ${pos.location || "the required location"} (relocation if needed)`);
    if (!row || row.ask_skills) questions.push(`hands-on experience with the key skills: ${skills.join(", ") || "the core skills for the role"}`);

    const firstMessage =
      row?.job_pitch?.trim() ||
      `Hi! Quick call about a ${pos.title} opening. Do you have a minute to chat?`;

    const systemPrompt = [
      `You are a friendly recruiter conducting a short first-round screening call for a ${pos.title} role.`,
      `Keep the conversation under 2 minutes. Be warm, natural, and human. Ask ONE question at a time and wait for the answer.`,
      `Screening topics to cover, in order:`,
      ...questions.map((q, i) => `${i + 1}. Ask about ${q}.`),
      `After the last topic, thank the candidate, say the team will review and get back to them, and end the call.`,
      `Never invent details you weren't told. If the candidate asks something you don't know, say the recruiter will follow up.`,
    ].join("\n");

    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`,
      { headers: { "xi-api-key": apiKey } },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`ElevenLabs token request failed (${res.status}): ${body || res.statusText}`);
    }
    const json = (await res.json()) as { token?: string };
    if (!json.token) throw new Error("ElevenLabs did not return a token.");

    return {
      token: json.token,
      agentId,
      systemPrompt,
      firstMessage,
      dynamicVariables: {
        candidate_name: "there",
        job_title: pos.title,
        company_name:
          (pos as { client?: { name?: string | null } | null }).client?.name ?? "our team",
      } as Record<string, string>,
    };
  });

export const getConversationDebug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ conversationId: z.string().min(1) }).parse(i))
  .handler(async ({ data }) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error("ElevenLabs is not connected.");
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(data.conversationId)}`,
      { headers: { "xi-api-key": apiKey } },
    );
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`ElevenLabs conversation fetch failed (${res.status}): ${text}`);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }
    const p = parsed as Record<string, unknown>;
    return {
      status: p.status ?? null,
      terminationReason:
        (p.termination_reason as string | undefined) ??
        ((p.metadata as Record<string, unknown> | undefined)?.termination_reason as string | undefined) ??
        null,
      callDuration:
        (p.call_duration_secs as number | undefined) ??
        ((p.metadata as Record<string, unknown> | undefined)?.call_duration_secs as number | undefined) ??
        null,
      analysis: p.analysis ?? null,
      metadata: p.metadata ?? null,
      transcript: p.transcript ?? null,
      rawJson: JSON.stringify(parsed),
    };
  });

/**
 * Start a screening call for a specific candidate on a position.
 * Only "browser" mode is wired for now; "phone" returns a not-configured error.
 */
export const startCandidateScreening = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        candidateId: z.string().uuid(),
        positionId: z.string().uuid(),
        mode: z.enum(["browser", "phone"]).default("browser"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const agentId = process.env.ELEVENLABS_SCREENER_AGENT_ID;
    if (!apiKey) throw new Error("ElevenLabs is not connected. Ask an admin to link ElevenLabs in Connectors.");
    if (!agentId) throw new Error("Missing ELEVENLABS_SCREENER_AGENT_ID secret.");

    if (data.mode === "phone") {
      const enabled = process.env.OUTBOUND_CALLING_ENABLED === "true";
      if (!enabled) {
        throw new Error(
          "Outbound calling isn't configured yet. Use 'Rehearse in browser' or set up a Twilio number first.",
        );
      }
    }

    const { data: cand, error: cErr } = await supabase
      .from("candidates")
      .select("id, name, phone, agency_id")
      .eq("id", data.candidateId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!cand) throw new Error("Candidate not found");
    if (data.mode === "phone" && !cand.phone) {
      throw new Error("Candidate has no phone number saved.");
    }

    const { data: pos, error: pErr } = await supabase
      .from("positions")
      .select("id, title, skills, location, experience, client:clients(name)")
      .eq("id", data.positionId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!pos) throw new Error("Position not found");

    const { data: row } = await supabase
      .from("position_ai_screeners")
      .select("*")
      .eq("position_id", data.positionId)
      .maybeSingle();

    const skills = ((pos.skills ?? []) as string[]).slice(0, 8);
    const questions: string[] = [];
    if (!row || row.ask_notice_ctc) questions.push("current notice period and current CTC (compensation)");
    if (!row || row.ask_location) questions.push(`willingness to work in ${pos.location || "the required location"}`);
    if (!row || row.ask_skills) questions.push(`hands-on experience with the key skills: ${skills.join(", ") || "the core skills for the role"}`);

    const firstMessage =
      row?.job_pitch?.trim() ||
      `Hi ${cand.name.split(" ")[0]}! Quick call about a ${pos.title} opening. Do you have a minute?`;

    const systemPrompt = [
      `You are a friendly recruiter conducting a short first-round screening call with ${cand.name} for a ${pos.title} role.`,
      `Keep it under 2 minutes. Warm, natural, human. One question at a time.`,
      `Screening topics to cover, in order:`,
      ...questions.map((q, i) => `${i + 1}. Ask about ${q}.`),
      `After the last topic, thank the candidate, say the team will review and get back to them, and end the call.`,
      `Never invent details you weren't told.`,
    ].join("\n");

    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`,
      { headers: { "xi-api-key": apiKey } },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`ElevenLabs token request failed (${res.status}): ${body || res.statusText}`);
    }
    const json = (await res.json()) as { token?: string };
    if (!json.token) throw new Error("ElevenLabs did not return a token.");

    return {
      token: json.token,
      agentId,
      mode: data.mode,
      systemPrompt,
      firstMessage,
      dynamicVariables: {
        candidate_name: cand.name.split(" ")[0] || cand.name,
        job_title: pos.title,
        company_name:
          (pos as { client?: { name?: string | null } | null }).client?.name ?? "our team",
      } as Record<string, string>,
    };
  });

/**
 * After a call ends, fetch the transcript from ElevenLabs and persist it.
 * Also notifies the position owner with the summary.
 */
export const recordScreeningResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        conversationId: z.string().min(1),
        candidateId: z.string().uuid(),
        positionId: z.string().uuid(),
        mode: z.enum(["browser", "phone"]).default("browser"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error("ElevenLabs is not connected.");

    // Give ElevenLabs a moment to finalize the record.
    await new Promise((r) => setTimeout(r, 2000));

    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(data.conversationId)}`,
      { headers: { "xi-api-key": apiKey } },
    );
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`ElevenLabs fetch failed (${res.status}): ${text}`);
    }
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parsed = {};
    }

    const metadata = (parsed.metadata as Record<string, unknown> | undefined) ?? {};
    const analysis = (parsed.analysis as Record<string, unknown> | undefined) ?? {};
    const durationSec =
      (parsed.call_duration_secs as number | undefined) ??
      (metadata.call_duration_secs as number | undefined) ??
      null;
    const summary =
      (analysis.transcript_summary as string | undefined) ??
      (analysis.summary as string | undefined) ??
      null;
    const successRaw =
      (analysis.call_successful as string | undefined) ??
      (analysis.evaluation_criteria_results as unknown as string | undefined) ??
      null;
    let verdict: string | null = null;
    if (typeof successRaw === "string") {
      if (successRaw.toLowerCase() === "success") verdict = "pass";
      else if (successRaw.toLowerCase() === "failure") verdict = "fail";
      else verdict = "unclear";
    }
    const status = (parsed.status as string | undefined) ?? "completed";

    // Look up the position's agency + application id (if any).
    const { data: pos } = await supabase
      .from("positions")
      .select("agency_id, title, created_by, assigned_recruiter_id, client:clients(name)")
      .eq("id", data.positionId)
      .maybeSingle();
    const { data: app } = await supabase
      .from("applications")
      .select("id")
      .eq("position_id", data.positionId)
      .eq("candidate_id", data.candidateId)
      .maybeSingle();
    const { data: cand } = await supabase
      .from("candidates")
      .select("name")
      .eq("id", data.candidateId)
      .maybeSingle();

    const { data: inserted, error: insErr } = await supabase
      .from("candidate_screening_calls")
      .insert({
        agency_id: pos?.agency_id,
        candidate_id: data.candidateId,
        position_id: data.positionId,
        application_id: app?.id ?? null,
        elevenlabs_conversation_id: data.conversationId,
        mode: data.mode,
        duration_sec: durationSec,
        transcript: (parsed.transcript ?? null) as never,
        summary,
        verdict,
        status,
        created_by: userId,
      })
      .select("id")
      .maybeSingle();
    if (insErr) throw new Error(insErr.message);

    // Best-effort notification to position owner / assignee.
    const recipients = new Set<string>();
    if (pos?.created_by) recipients.add(pos.created_by as string);
    if (pos?.assigned_recruiter_id) recipients.add(pos.assigned_recruiter_id as string);
    if (userId) recipients.add(userId);
    const bodyLine = summary
      ? summary.slice(0, 240)
      : `${cand?.name ?? "Candidate"} screening call · ${durationSec ?? 0}s${verdict ? ` · verdict: ${verdict}` : ""}`;
    if (recipients.size) {
      await supabase.from("notifications").insert(
        Array.from(recipients).map((uid) => ({
          user_id: uid,
          kind: "system" as const,
          title: `AI screening: ${cand?.name ?? "candidate"} · ${pos?.title ?? "role"}`,
          body: bodyLine,
          link: `/positions/${data.positionId}`,
        })),
      );
    }

    return {
      id: inserted?.id ?? null,
      summary,
      verdict,
      durationSec,
      status,
    };
  });

export const listCandidateScreeningCalls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ candidateId: z.string().uuid(), positionId: z.string().uuid().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("candidate_screening_calls")
      .select("id, position_id, mode, duration_sec, summary, verdict, status, created_at, elevenlabs_conversation_id")
      .eq("candidate_id", data.candidateId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data.positionId) q = q.eq("position_id", data.positionId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });