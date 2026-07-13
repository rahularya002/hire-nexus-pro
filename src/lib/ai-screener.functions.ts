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
      raw: parsed,
    };
  });