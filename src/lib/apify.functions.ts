import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  APIFY_ACTORS,
  buildActorInput,
  callApifyActor,
  normalizeForSource,
  rankBatch,
  searchGitHubUsers,
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
  openToWork: boolean;
  origin: "internal" | "apify";
};

const sourceEnum = z.enum(["linkedin", "github"]);

type SubmittedCandidateKeys = {
  ids: Set<string>;
  emails: Set<string>;
  urls: Set<string>;
};

function normalizeKey(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

function normalizeSkill(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\bdbs\b/g, "db")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/s$/, "");
}

function countSkillOverlap(candidateSkills: string[] | null | undefined, requiredSkills: string[]) {
  if (!requiredSkills.length) return 0;
  const candidate = (candidateSkills ?? []).map(normalizeSkill).filter(Boolean);
  const required = requiredSkills.map(normalizeSkill).filter(Boolean);
  let count = 0;
  for (const req of required) {
    if (candidate.some((skill) => skill === req || skill.includes(req) || req.includes(skill))) {
      count += 1;
    }
  }
  return count;
}

function submittedUrlKeys(row: { resume_url?: string | null; linkedin_url?: string | null; profile_url?: string | null }) {
  return [row.resume_url, row.linkedin_url, row.profile_url].map(normalizeKey).filter(Boolean) as string[];
}

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
    let submittedKeysPromise: Promise<SubmittedCandidateKeys> | null = null;

    function getSubmittedKeys() {
      if (!data.positionId) {
        return Promise.resolve({ ids: new Set<string>(), emails: new Set<string>(), urls: new Set<string>() });
      }
      submittedKeysPromise ??= (async () => {
        const { data: submitted } = await supabase
          .from("applications")
          .select("candidate_id, candidate:candidates(id,email,resume_url,linkedin_url)")
          .eq("position_id", data.positionId);
        const keys: SubmittedCandidateKeys = {
          ids: new Set<string>(),
          emails: new Set<string>(),
          urls: new Set<string>(),
        };
        for (const app of submitted ?? []) {
          if (app.candidate_id) keys.ids.add(app.candidate_id);
          const candidate = app.candidate as unknown as {
            id?: string | null;
            email?: string | null;
            resume_url?: string | null;
            linkedin_url?: string | null;
          } | null;
          if (candidate?.id) keys.ids.add(candidate.id);
          const email = normalizeKey(candidate?.email);
          if (email) keys.emails.add(email);
          for (const url of submittedUrlKeys(candidate ?? {})) keys.urls.add(url);
        }
        return keys;
      })();
      return submittedKeysPromise;
    }

    // Always also pull from the internal candidate DB (manually added candidates).
    // These never reach sourced_candidates / position_sourced_matches, so without
    // this they'd be invisible in scout results even with matching skills.
    async function fetchInternalCandidates(): Promise<SourcedMatchView[]> {
      const submitted = await getSubmittedKeys();
      let q = supabase
        .from("candidates")
        .select("id, name, role, current_company, location, experience, skills, email, phone, linkedin_url, resume_url")
        .limit(Math.max(data.limit * 8, 100));
      if (!skills.length) q = q.ilike("role", `%${data.jobTitle}%`);
      const { data: rows } = await q;
      let pool = (rows ?? [])
        .map((candidate) => ({
          ...candidate,
          _skillOverlap: countSkillOverlap(candidate.skills, skills),
        }))
        .filter((candidate) => {
          const email = normalizeKey(candidate.email);
          const urls = submittedUrlKeys(candidate);
          if (submitted.ids.has(candidate.id)) return false;
          if (email && submitted.emails.has(email)) return false;
          if (urls.some((url) => submitted.urls.has(url))) return false;
          return true;
        });
      if (skills.length) {
        const title = data.jobTitle.toLowerCase().trim();
        pool = pool.filter((candidate) => {
          const role = candidate.role?.toLowerCase() ?? "";
          return candidate._skillOverlap > 0 || (!!role && (role.includes(title) || title.includes(role)));
        });
      }
      pool = pool
        .sort((a, b) => b._skillOverlap - a._skillOverlap)
        .slice(0, data.limit);
      return pool.map((c) => {
        const expNum = c.experience ? Number(String(c.experience).replace(/[^0-9.]/g, "")) : null;
        return {
          matchId: null,
          sourcedCandidateId: c.id,
          source: "database",
          name: c.name,
          headline: c.role ?? null,
          currentCompany: c.current_company ?? null,
          location: c.location ?? null,
          experienceYears: expNum && !Number.isNaN(expNum) ? expNum : null,
          skills: c.skills ?? [],
          email: c.email ?? null,
          phone: c.phone ?? null,
          profileUrl: c.linkedin_url ?? c.resume_url ?? null,
          avatarUrl: null,
          matchScore: skills.length ? Math.min(98, 60 + c._skillOverlap * 10) : null,
          reasoning: "From your candidate database",
          rejected: false,
          openToWork: false,
          origin: "internal" as const,
        } satisfies SourcedMatchView;
      });
    }

    // If we have a positionId, return ALL matches for that position
    // (ranked by score, excluding rejects) — regardless of skill overlap.
    if (data.positionId) {
      const { data: matchRows, error: mErr } = await supabase
        .from("position_sourced_matches")
        .select(
          "id, match_score, reasoning, rejected, shortlisted_candidate_id, sourced_candidate_id, sourced_candidates!inner(id, source, name, headline, current_company, location, experience_years, skills, email, phone, profile_url, avatar_url, open_to_work, is_hiring)",
        )
        .eq("position_id", data.positionId)
        .eq("rejected", false)
        .is("shortlisted_candidate_id", null)
      .gte("match_score", 50)
        .order("match_score", { ascending: false, nullsFirst: false })
        .limit(data.limit);
      if (mErr) throw new Error(mErr.message);
      const submitted = await getSubmittedKeys();
      const matches: SourcedMatchView[] = (matchRows ?? [])
        .map((m) => {
        const c = m.sourced_candidates as unknown as {
          id: string; source: string; name: string; headline: string | null;
          current_company: string | null; location: string | null;
          experience_years: number | string | null; skills: string[] | null;
          email: string | null; phone: string | null;
          profile_url: string | null; avatar_url: string | null;
          open_to_work?: boolean | null; is_hiring?: boolean | null;
        };
        return {
          matchId: m.id,
          sourcedCandidateId: c.id,
          source: c.source,
          name: c.name,
          headline: c.headline,
          currentCompany: c.current_company,
          location: c.location,
          experienceYears: c.experience_years ? Number(c.experience_years) : null,
          skills: c.skills ?? [],
          email: c.email,
          phone: c.phone,
          profileUrl: c.profile_url,
          avatarUrl: c.avatar_url,
          matchScore: m.match_score,
          reasoning: m.reasoning,
          rejected: m.rejected,
          openToWork: !!c.open_to_work,
          _isHiring: !!c.is_hiring,
          origin: "internal" as const,
        } as SourcedMatchView & { _isHiring: boolean };
      })
      // Hide hiring/recruiter profiles from results
      .filter((m) => !(m as unknown as { _isHiring: boolean })._isHiring)
      // Hide candidates already submitted/shared for this same position, even when
      // the sourced match row predates the shortlist link.
      .filter((m) => {
        const email = normalizeKey(m.email);
        const profileUrl = normalizeKey(m.profileUrl);
        if (email && submitted.emails.has(email)) return false;
        if (profileUrl && submitted.urls.has(profileUrl)) return false;
        return true;
      })
      // Sort: OTW first, then by score
      .sort((a, b) => {
        if (a.openToWork !== b.openToWork) return a.openToWork ? -1 : 1;
        return (b.matchScore ?? -1) - (a.matchScore ?? -1);
      });
      const internal = await fetchInternalCandidates();
      const seen = new Set(matches.map((m) => (m.email ?? "").toLowerCase()).filter(Boolean));
      const merged = [...internal.filter((c) => !c.email || !seen.has(c.email.toLowerCase())), ...matches];
      return { matches: merged };
    }

    let query = supabase
      .from("sourced_candidates")
      .select(
        "id, source, name, headline, current_company, location, experience_years, skills, email, phone, profile_url, avatar_url, open_to_work, is_hiring",
      )
      .eq("is_hiring", false)
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
    const internalDb = await fetchInternalCandidates();
    if (!candidates.length)
      return { matches: internalDb };

    const matches: SourcedMatchView[] = candidates
      .map((c) => {
        return {
          matchId: null,
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
          matchScore: null,
          reasoning: null,
          rejected: false,
          openToWork: !!(c as { open_to_work?: boolean | null }).open_to_work,
          origin: "internal" as const,
        };
      })
      .sort((a, b) => {
        if (a.openToWork !== b.openToWork) return a.openToWork ? -1 : 1;
        return (b.matchScore ?? -1) - (a.matchScore ?? -1);
      });

    const seen = new Set(matches.map((m) => (m.email ?? "").toLowerCase()).filter(Boolean));
    const merged = [...internalDb.filter((c) => !c.email || !seen.has(c.email.toLowerCase())), ...matches];
    return { matches: merged };
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
        } as never)
        .select("id")
        .single();
      if (runErr) throw new Error(runErr.message);
      runId = run.id;
    }

    const allProfiles: NormalizedProfile[] = [];
    const errors: string[] = [];

    for (const source of data.sources) {
      try {
        if (source === "github") {
          // Use GitHub's public REST API — free, reliable, no Apify actor needed.
          const profiles = await searchGitHubUsers({
            jobTitle: data.jobTitle,
            location: data.location,
            skills: data.skills,
            maxResults: data.maxResults,
          });
          allProfiles.push(...profiles);
        } else {
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
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`Apify ${source} failed:`, msg);
        errors.push(`${source}: ${msg}`);
      }
    }

    // Upsert candidates
    const sourcedIds: string[] = [];
    // Defense in depth: drop any profile flagged as hiring (recruiter, "we're hiring")
    // unless they are also OTW themselves. Then sort OTW-first.
    const filteredProfiles = allProfiles
      .filter((p) => !(p.is_hiring && !p.open_to_work))
      .sort((a, b) => Number(b.open_to_work) - Number(a.open_to_work));
    // Replace allProfiles content downstream
    allProfiles.length = 0;
    allProfiles.push(...filteredProfiles);
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
            open_to_work: p.open_to_work,
            is_hiring: p.is_hiring,
            raw: p.raw as unknown as Record<string, never>,
            last_seen_at: new Date().toISOString(),
          })) as never,
          { onConflict: "source,source_profile_id" },
        )
        .select("id, source, source_profile_id");
      if (upErr) throw new Error(upErr.message);
      sourcedIds.push(...(upserted ?? []).map((r) => r.id));
    }

    // Mirror into candidates table so they show up in the candidate DB.
    // Dedupe by resume_url (profile URL) — already-imported profiles are skipped.
    if (allProfiles.length) {
      const profileUrls = allProfiles.map((p) => p.profile_url).filter(Boolean) as string[];
      const existing = new Set<string>();
      if (profileUrls.length) {
        const { data: existingRows } = await supabase
          .from("candidates")
          .select("resume_url")
          .in("resume_url", profileUrls);
        for (const r of existingRows ?? []) {
          if (r.resume_url) existing.add(r.resume_url);
        }
      }
      const emails = allProfiles.map((p) => p.email).filter(Boolean) as string[];
      const existingEmails = new Set<string>();
      if (emails.length) {
        const { data: emRows } = await supabase
          .from("candidates")
          .select("email")
          .in("email", emails);
        for (const r of emRows ?? []) {
          if (r.email) existingEmails.add(r.email);
        }
      }
      const seenEmails = new Set<string>();
      const toInsert = allProfiles
        .filter((p) => p.profile_url && !existing.has(p.profile_url))
        .filter((p) => {
          if (!p.email) return true;
          if (existingEmails.has(p.email) || seenEmails.has(p.email)) return false;
          seenEmails.add(p.email);
          return true;
        })
        .map((p) => ({
          name: p.name,
          email: p.email,
          phone: p.phone,
          role: p.headline,
          current_company: p.current_company,
          location: p.location,
          experience: p.experience_years ? `${p.experience_years} years` : null,
          skills: p.skills ?? [],
          source: "scout" as const,
          resume_url: p.profile_url,
          linkedin_url: p.source === "linkedin" ? p.profile_url : null,
          created_by: userId,
        }));
      if (toInsert.length) {
        const { error: cErr } = await supabase.from("candidates").insert(toInsert as never);
        if (cErr) console.warn("Mirror to candidates failed:", cErr.message);
      }
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
          })) as never,
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
        "id, name, headline, current_company, location, experience_years, skills, open_to_work",
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
        open_to_work: !!(r as { open_to_work?: boolean | null }).open_to_work,
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
        linkedin_url: sc.source === "linkedin" ? sc.profile_url : null,
        created_by: userId,
      } as never)
      .select("id")
      .single();
    if (candErr) throw new Error(candErr.message);

    // Create application at sourcing stage
    const { error: appErr } = await supabase.from("applications").insert({
      position_id: data.positionId,
      candidate_id: cand.id,
      stage: "sourcing",
      created_by: userId,
    } as never);
    if (appErr) throw new Error(appErr.message);

    // Mark match as shortlisted
    await supabase
      .from("position_sourced_matches")
      .update({ shortlisted_candidate_id: cand.id })
      .eq("id", data.matchId);

    // Promote the position to in_progress so it shows up in Ongoing mandates.
    await supabase
      .from("positions")
      .update({ status: "in_progress" })
      .eq("id", data.positionId)
      .eq("status", "open");

    return { ok: true, candidateId: cand.id };
  });