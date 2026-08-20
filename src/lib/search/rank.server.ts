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

/** Occupation evidence tier. "specific" = the full requested title, "generic" =
 *  only the head noun (designer for fashion designer), "none" = no evidence. */
type RoleTier = "open" | "specific" | "generic" | "none";

function roleEvidence(plan: SearchPlan, roleField: string, hay: string): { tier: RoleTier; hits: string[] } {
  const terms = plan.roles.map((r) => r.trim().toLowerCase()).filter(Boolean);
  if (terms.length === 0) return { tier: "open", hits: [] };

  const specific = terms.filter((t) => t.includes(" "));
  const generic = Array.from(
    new Set([
      ...terms.filter((t) => !t.includes(" ")),
      ...terms.map((t) => t.split(/\s+/).pop()!).filter((w) => w.length > 3),
    ]),
  );

  const specificHits = specific.filter((t) => roleField.includes(t) || hay.includes(t));
  if (specificHits.length) return { tier: "specific", hits: specificHits };

  const genericInField = generic.filter((w) => roleField.includes(w));
  if (genericInField.length) return { tier: "generic", hits: genericInField };

  // Attachment / body evidence for the occupation concept — weaker, but still
  // real: the resume may say "Fashion Designer" while the email subject doesn't.
  const genericInHay = generic.filter((w) => hay.includes(` ${w}`));
  if (genericInHay.length) return { tier: "generic", hits: genericInHay };

  return { tier: "none", hits: [] };
}

export function rankItem(
  plan: SearchPlan,
  i: RankInput,
): { score: number; parts: ScoreParts; qualified: boolean } {
  const hay = ` ${i.haystack.toLowerCase()} `;
  const matched: string[] = [];
  const missing: string[] = [];

  const roleField = `${i.extracted.role ?? ""}`.toLowerCase();
  const ev = roleEvidence(plan, roleField, hay);
  // The requested occupation is a required criterion: location, seniority and
  // years refine a role match, they never substitute for one.
  const role = ev.tier === "open" ? 18 : ev.tier === "specific" ? 34 : ev.tier === "generic" ? 16 : 0;
  if (ev.tier === "none") missing.push("role not mentioned");
  if (ev.tier === "generic") missing.push("related role, not an exact title match");
  if (ev.hits.length) matched.push(...ev.hits.slice(0, 3));

  const skillList = (i.extracted.skills ?? []).map((s) => s.toLowerCase());
  const wanted = Array.from(new Set([...plan.skills, ...plan.keywords]));
  const skillHits = wanted.filter((s) => skillList.includes(s) || hay.includes(s.toLowerCase()));
  const skills = wanted.length === 0 ? 12 : Math.min(20, skillHits.length * 7);
  if (skillHits.length) matched.push(...skillHits.slice(0, 4));
  else if (wanted.length) missing.push("no skill overlap");

  const wantedLoc = expandLocations(plan.locations);
  const locField = (i.extracted.location ?? "").toLowerCase();
  const fieldHit = wantedLoc.find((l) => locField.includes(l));
  const mailHit = wantedLoc.find((l) => hay.includes(` ${l} `));
  let location = 10;
  if (wantedLoc.length) {
    if (fieldHit) {
      location = 20;
      matched.push(fieldHit);
    } else if (locField) {
      // The candidate's own location is known and it is not what was asked for.
      location = 2;
      missing.push(`based in ${i.extracted.location}`);
    } else if (mailHit) {
      // Only the surrounding email mentions the city — weak evidence.
      location = 8;
      missing.push("location not confirmed");
    } else {
      location = 0;
      missing.push("location not confirmed");
    }
  }

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

  let raw = role + skills + location + years + resume + recency;
  // An explicit skill ask that nothing satisfies should not rank near a real match.
  if (wanted.length > 0 && skillHits.length === 0) raw *= 0.6;
  // Only a loosely related occupation: never let it read like a direct hit.
  if (ev.tier === "generic") raw *= 0.75;
  const confidenceFactor = 0.6 + Math.min(100, Math.max(0, i.confidence)) / 250; // 0.6 – 1.0
  const score = ev.tier === "none" ? 0 : Math.max(0, Math.min(100, Math.round(raw * confidenceFactor)));

  return {
    score,
    // A query that names an occupation excludes people with no role evidence.
    qualified: ev.tier !== "none",
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