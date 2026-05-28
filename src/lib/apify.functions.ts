import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  APIFY_ACTORS,
  buildActorInput,
  callApifyActor,
  normalizeForSource,
  rankBatch,
  type ApifySourceId,
  type NormalizedProfile,
} from "./apify.server";

export type SourcedMatchView = {
  matchId: string | null; // null when no positionId (pure search)
  sourcedCandidateId: string;
  source: string;
  name: string;
  headline: string | null;
  currentCompany: string | null;
  location: string | null;
  experienceYears: number | null;
  skills: string[];
  email: string | null;
  phone: string | null;
  profileUrl: string | null;
  avatarUrl: string | null;
  matchScore: number | null;
  reasoning: string | null;
  rejected: boolean;
  origin: "internal" | "apify";
};

const sourceEnum = z.enum(["linkedin", "github"]);

// ---------- search internal cache first ----------

export const searchSourcedCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        positionId: z.string().uuid().optional(),
        jobTitle: z.string().min(2).max(200),
        skills: z.array(z.string().min(1).max(80)).max(30).default([]),
        location: z.string().max(200).optional(),
        limit: z.number().min(1).max(100).default(25),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const skills = data.skills.map((s) => s.toLowerCase().trim()).filter(Boolean);

    let query = supabase
      .from("sourced_candidates")
      .select(
        "id, source, name, headline, current_company, location, experience_years, skills, email, phone, profile_url, avatar_url",
      )
      .limit(data.limit);

    if (skills.length) {
      query = query.overlaps("skills", skills);
    } else {
      // fall back to title fuzzy
      query = query.ilike("headline", `%${data.jobTitle}%`);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const candidates = rows ?? [];
    if (!candidates.length)
      return { matches: [] as SourcedMatchView[] };

    // Pull existing matches for this position so we can show score & exclude rejects
    let matchMap = new Map<
      string,
      { id: string; match_score: number | null; reasoning: string | null; rejected: boolean }
    >();
    if (data.positionId) {
      const { data: matches } = await supabase
        .from("position_sourced_matches")
        .select("id, sourced_candidate_id, match_score, reasoning, rejected")
        .eq("position_id", data.positionId)
        .in(
          "sourced_candidate_id",
          candidates.map((c) => c.id),
        );
      for (const m of matches ?? []) {
        matchMap.set(m.sourced_candidate_id, {
          id: m.id,
          match_score: m.match_score,
          reasoning: m.reasoning,
          rejected: m.rejected,
        });
      }
    }

    const matches: SourcedMatchView[] = candidates
      .map((c) => {
        const m = matchMap.get(c.id);
        return {
          matchId: m?.id ?? null,
          sourcedCandidateId: c.id,
          source: c.source,
          name: c.name,
          headline: c.headline,
          currentCompany: c.current_company,
          location: c.location,
          experienceYears: c.experience_years
            ? Number(c.experience_years)
            : null,
          skills: c.skills ?? [],
          email: c.email,
          phone: c.phone,
          profileUrl: c.profile_url,
          avatarUrl: c.avatar_url,
          matchScore: m?.match_score ?? null,
          reasoning: m?.reasoning ?? null,
          rejected: m?.rejected ?? false,
          origin: "internal" as const,
        };
      })
      .filter((m) => !m.rejected)
      .sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1));

    return { matches };
  });

// ---------- run Apify and store results ----------

export const runApifyScout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        positionId: z.string().uuid().optional(),
        sources: z.array(sourceEnum).min(1).max(2),
        jobTitle: z.string().min(2).max(200),
        skills: z.array(z.string().min(1).max(80)).max(20).default([]),
        location: z.string().max(200).optional(),
        jdText: z.string().max(20_000).optional(),
        maxResults: z.number().min(1).max(25).default(15),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Rate limit: max 5 runs per position per hour
    if (data.positionId) {
      const since = new Date(Date.now() - 60 * 60_000).toISOString();
      const { count } = await supabase
        .from("position_sourcing_runs")
        .select("id", { count: "exact", head: true })
        .eq("position_id", data.positionId)
        .gte("created_at", since);
      if ((count ?? 0) >= 5) {
        throw new Error("Rate limit: 5 Apify runs per position per hour.");
      }
    }

    // create run row
    let runId: string | null = null;
    if (data.positionId) {
      const { data: run, error: runErr } = await supabase
        .from("position_sourcing_runs")
        .insert({
          position_id: data.positionId,
          triggered_by: userId,
          sources: data.sources,
          status: "running",
        })
        .select("id")
        .single();
      if (runErr) throw new Error(runErr.message);
      runId = run.id;
    }

    const allProfiles: NormalizedProfile[] = [];
    const errors: string[] = [];

    for (const source of data.sources) {
      try {
        const actorId = APIFY_ACTORS[source as ApifySourceId];
        const input = buildActorInput(source as ApifySourceId, {
          jobTitle: data.jobTitle,
          location: data.location,
          skills: data.skills,
          maxResults: data.maxResults,
        });
        const items = await callApifyActor(actorId, input);
        for (const item of items) {
          const norm = normalizeForSource(source as ApifySourceId, item);
          if (norm) allProfiles.push(norm);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`Apify ${source} failed:`, msg);
        errors.push(`${source}: ${msg}`);
      }
    }

    // Upsert candidates
    const sourcedIds: string[] = [];
    if (allProfiles.length) {
      const { data: upserted, error: upErr } = await supabase
        .from("sourced_candidates")
        .upsert(
          allProfiles.map((p) => ({
            source: p.source,
            source_profile_id: p.source_profile_id,
            name: p.name,
            headline: p.headline,
            current_company: p.current_company,
            location: p.location,
            experience_years: p.experience_years,
            skills: p.skills,
            email: p.email,
            phone: p.phone,
            profile_url: p.profile_url,
            avatar_url: p.avatar_url,
            raw: p.raw as unknown as Record<string, never>,
            last_seen_at: new Date().toISOString(),
          })) as never,
          { onConflict: "source,source_profile_id" },
        )
        .select("id, source, source_profile_id");
      if (upErr) throw new Error(upErr.message);
      sourcedIds.push(...(upserted ?? []).map((r) => r.id));
    }

    // Create position_sourced_matches rows if positionId
    let createdMatches: { id: string; sourced_candidate_id: string }[] = [];
    if (data.positionId && sourcedIds.length) {
      const { data: ms, error: mErr } = await supabase
        .from("position_sourced_matches")
        .upsert(
          sourcedIds.map((id) => ({
            position_id: data.positionId!,
            sourced_candidate_id: id,
            run_id: runId,
          })),
          { onConflict: "position_id,sourced_candidate_id", ignoreDuplicates: false },
        )
        .select("id, sourced_candidate_id");
      if (mErr) throw new Error(mErr.message);
      createdMatches = ms ?? [];
    }

    // Update run row
    if (runId) {
      await supabase
        .from("position_sourcing_runs")
        .update({
          status: errors.length && !allProfiles.length ? "failed" : "succeeded",
          result_count: allProfiles.length,
          error: errors.length ? errors.join(" | ") : null,
          finished_at: new Date().toISOString(),
        })
        .eq("id", runId);
    }

    return {
      runId,
      resultCount: allProfiles.length,
      sourcedIds,
      createdMatchIds: createdMatches.map((m) => m.id),
      errors,
    };
  });

// ---------- AI rank a batch ----------

export const rankSourcedMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        positionId: z.string().uuid(),
        jdText: z.string().min(20).max(20_000),
        sourcedCandidateIds: z.array(z.string().uuid()).min(1).max(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: rows, error } = await supabase
      .from("sourced_candidates")
      .select(
        "id, name, headline, current_company, location, experience_years, skills",
      )
      .in("id", data.sourcedCandidateIds);
    if (error) throw new Error(error.message);
    if (!rows?.length) return { ranked: 0 };

    // Batch 20 per AI call
    const batchSize = 20;
    const allResults: { id: string; matchScore: number; reasoning: string }[] = [];
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize).map((r) => ({
        id: r.id,
        name: r.name,
        headline: r.headline,
        current_company: r.current_company,
        location: r.location,
        experience_years: r.experience_years ? Number(r.experience_years) : null,
        skills: r.skills ?? [],
      }));
      const results = await rankBatch(data.jdText, batch);
      allResults.push(...results);
    }

    // Update matches
    for (const r of allResults) {
      await supabase
        .from("position_sourced_matches")
        .update({ match_score: r.matchScore, reasoning: r.reasoning })
        .eq("position_id", data.positionId)
        .eq("sourced_candidate_id", r.id);
    }

    return { ranked: allResults.length };
  });

// ---------- Reject / shortlist ----------

export const rejectSourcedMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        matchId: z.string().uuid(),
        reason: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("position_sourced_matches")
      .update({ rejected: true, rejected_reason: data.reason ?? null })
      .eq("id", data.matchId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const shortlistSourcedMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        matchId: z.string().uuid(),
        positionId: z.string().uuid(),
        sourcedCandidateId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Pull sourced candidate
    const { data: sc, error: scErr } = await supabase
      .from("sourced_candidates")
      .select(
        "name, headline, current_company, location, experience_years, skills, email, phone, profile_url, source",
      )
      .eq("id", data.sourcedCandidateId)
      .single();
    if (scErr || !sc) throw new Error(scErr?.message ?? "Sourced candidate not found");

    // Insert into candidates
    const { data: cand, error: candErr } = await supabase
      .from("candidates")
      .insert({
        name: sc.name,
        email: sc.email,
        phone: sc.phone,
        role: sc.headline,
        current_company: sc.current_company,
        location: sc.location,
        experience: sc.experience_years ? `${sc.experience_years} years` : null,
        skills: sc.skills ?? [],
        source: "scout",
        resume_url: sc.profile_url,
        created_by: userId,
      })
      .select("id")
      .single();
    if (candErr) throw new Error(candErr.message);

    // Create application at sourcing stage
    const { error: appErr } = await supabase.from("applications").insert({
      position_id: data.positionId,
      candidate_id: cand.id,
      stage: "sourcing",
      created_by: userId,
    });
    if (appErr) throw new Error(appErr.message);

    // Mark match as shortlisted
    await supabase
      .from("position_sourced_matches")
      .update({ shortlisted_candidate_id: cand.id })
      .eq("id", data.matchId);

    return { ok: true, candidateId: cand.id };
  });