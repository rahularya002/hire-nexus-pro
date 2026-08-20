// Score a candidate against the recruiter's plan. Everything here is
// deterministic so the UI can show exactly why a result ranked where it did.
import type { Extracted } from "../recruitment-classify.server";
import { expandLocations, type SearchPlan } from "./query-plan.server";

export type ScoreParts = {
  role: number;
  skills: number;
  location: number;
  years: number;
  resume: number;
  recency: number;
  matched: string[];
  missing: string[];
};

export type RankInput = {
  extracted: Extracted;
  confidence: number;
  hasResume: boolean;
  sentAt: string | null;
  haystack: string;
};

function yearsOf(experience: string | null | undefined): number | null {
  const m = (experience ?? "").match(/(\d{1,2}(?:\.\d)?)/);
  return m ? Number(m[1]) : null;
}

export function rankItem(plan: SearchPlan, i: RankInput): { score: number; parts: ScoreParts } {
  const hay = ` ${i.haystack.toLowerCase()} `;
  const matched: string[] = [];
  const missing: string[] = [];

  const roleTerms = plan.roles;
  const roleHits = roleTerms.filter((r) => hay.includes(r.toLowerCase()));
  const roleField = `${i.extracted.role ?? ""}`.toLowerCase();
  const roleInField = roleTerms.some((r) => roleField.includes(r.toLowerCase()));
  let role = 0;
  if (roleTerms.length === 0) role = 18;
  else if (roleInField) role = 30;
  else if (roleHits.length) role = Math.min(26, 14 + roleHits.length * 6);
  else missing.push("role not mentioned");
  if (roleHits.length) matched.push(...roleHits.slice(0, 3));

  const skillList = (i.extracted.skills ?? []).map((s) => s.toLowerCase());
  const wanted = Array.from(new Set([...plan.skills, ...plan.keywords]));
  const skillHits = wanted.filter((s) => skillList.includes(s) || hay.includes(s.toLowerCase()));
  const skills = wanted.length === 0 ? 12 : Math.min(20, skillHits.length * 7);
  if (skillHits.length) matched.push(...skillHits.slice(0, 4));
  else if (wanted.length) missing.push("no skill overlap");

  const wantedLoc = expandLocations(plan.locations);
  const locField = (i.extracted.location ?? "").toLowerCase();
  const locHit = wantedLoc.find((l) => locField.includes(l) || hay.includes(` ${l} `));
  const location = wantedLoc.length === 0 ? 10 : locHit ? 20 : 0;
  if (locHit) matched.push(locHit);
  else if (wantedLoc.length) missing.push("location not confirmed");

  const y = yearsOf(i.extracted.experience);
  let years = 0;
  if (plan.minYears == null && plan.maxYears == null) years = 10;
  else if (y == null) {
    years = 4;
    missing.push("experience unknown");
  } else {
    const okMin = plan.minYears == null || y >= plan.minYears;
    const okMax = plan.maxYears == null || y <= plan.maxYears;
    if (okMin && okMax) {
      years = 15;
      matched.push(`${y} yrs`);
    } else {
      years = okMin || okMax ? 5 : 0;
      missing.push(`${y} yrs outside range`);
    }
  }

  const resume = i.hasResume ? 10 : 0;
  if (i.hasResume) matched.push("resume attached");
  else missing.push("no resume file");

  const ageDays = i.sentAt ? (Date.now() - new Date(i.sentAt).getTime()) / 86_400_000 : 3650;
  const recency = ageDays <= 90 ? 5 : ageDays <= 365 ? 3 : ageDays <= 1095 ? 1 : 0;

  const raw = role + skills + location + years + resume + recency;
  const confidenceFactor = 0.6 + Math.min(100, Math.max(0, i.confidence)) / 250; // 0.6 – 1.0
  const score = Math.max(0, Math.min(100, Math.round(raw * confidenceFactor)));

  return {
    score,
    parts: {
      role,
      skills,
      location,
      years,
      resume,
      recency,
      matched: Array.from(new Set(matched)).slice(0, 8),
      missing: Array.from(new Set(missing)).slice(0, 4),
    },
  };
}