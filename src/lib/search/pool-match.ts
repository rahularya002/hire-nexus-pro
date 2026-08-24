// Relevance for the *structured* candidate pool (the Candidate Grid), as opposed
// to Gmail hits. Pure and client-safe so it can be unit tested directly.
//
// The occupation rule is identical to Gmail search: when the recruiter names a
// specific occupation ("fashion designer"), only candidates whose actual role is
// that occupation (or an adjacent domain) qualify. Skills, location and years
// refine a role match — they never substitute for one.
import { matchOccupation, occupationRequirement, type OccupationTier } from "./occupation";

export type PoolPlan = {
  roles: string[];
  skills: string[];
  locations: string[];
  keywords: string[];
  minYears: number | null;
  maxYears: number | null;
};

export type PoolCandidate = {
  role?: string | null;
  skills?: (string | null | undefined)[] | null;
  location?: string | null;
  experience?: string | null;
  relevant_experience?: string | null;
  current_company?: string | null;
  industry?: string | null;
  education?: string | null;
  notes?: string | null;
  previous_companies?: (string | null | undefined)[] | null;
};

export type PoolMatch = {
  score: number;
  qualified: boolean;
  tier: OccupationTier;
  matched: string[];
  missing: string[];
};

function yearsOf(...values: (string | null | undefined)[]): number | null {
  for (const v of values) {
    const m = (v ?? "").match(/(\d{1,2}(?:\.\d)?)/);
    if (m) return Number(m[1]);
  }
  return null;
}

function haystack(c: PoolCandidate): string {
  return ` ${[
    c.role,
    c.current_company,
    c.industry,
    c.education,
    c.notes,
    c.experience,
    c.relevant_experience,
    ...(c.skills ?? []),
    ...(c.previous_companies ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()} `;
}

/**
 * @param plan   parsed query; `locations` must already be alias-expanded.
 */
export function matchPoolCandidate(plan: PoolPlan, c: PoolCandidate): PoolMatch {
  const hay = haystack(c);
  const matched: string[] = [];
  const missing: string[] = [];

  const req = occupationRequirement(plan.roles);
  const ev = matchOccupation(req, { role: c.role, skills: c.skills ?? [], text: hay });
  const tier = ev.tier;
  const role =
    tier === "open" ? 18
    : tier === "specific" ? 36
    : tier === "related" ? 26
    : tier === "generic" ? (req.specificity === "generic" ? 30 : 8)
    : 0;
  if (tier === "none") missing.push("role not mentioned");
  if (tier === "related") missing.push("adjacent role, not an exact occupation match");
  if (tier === "generic" && req.specificity === "specific") {
    missing.push(`not a ${req.specs[0]?.phrase ?? "matching"} role`);
  }
  if (ev.hits.length) matched.push(...ev.hits.slice(0, 3));

  const own = (c.skills ?? []).filter(Boolean).map((s) => String(s).toLowerCase());
  const wanted = Array.from(new Set([...plan.skills, ...plan.keywords].map((s) => s.toLowerCase())));
  const skillHits = wanted.filter((s) => own.includes(s) || hay.includes(s));
  const skills = wanted.length === 0 ? 12 : Math.min(22, skillHits.length * 8);
  if (skillHits.length) matched.push(...skillHits.slice(0, 4));
  else if (wanted.length) missing.push("no skill overlap");

  const locField = (c.location ?? "").toLowerCase();
  let location = 12;
  if (plan.locations.length) {
    const hit = plan.locations.find((l) => locField.includes(l.toLowerCase()));
    if (hit) {
      location = 22;
      matched.push(hit);
    } else if (locField) {
      location = 2;
      missing.push(`based in ${c.location}`);
    } else {
      location = 0;
      missing.push("location unknown");
    }
  }

  const y = yearsOf(c.experience, c.relevant_experience);
  let years = 0;
  if (plan.minYears == null && plan.maxYears == null) years = 10;
  else if (y == null) {
    years = 4;
    missing.push("experience unknown");
  } else {
    const okMin = plan.minYears == null || y >= plan.minYears;
    const okMax = plan.maxYears == null || y <= plan.maxYears;
    if (okMin && okMax) {
      years = 16;
      matched.push(`${y} yrs`);
    } else {
      years = okMin || okMax ? 5 : 0;
      missing.push(`${y} yrs outside range`);
    }
  }

  let raw = role + skills + location + years;
  if (wanted.length > 0 && skillHits.length === 0) raw *= 0.7;
  if (tier === "related") raw *= 0.8;

  const qualified =
    req.specificity === "none"
      ? true
      : req.specificity === "generic"
        ? tier === "generic" || tier === "specific" || tier === "related"
        : tier === "specific" || tier === "related";

  return {
    score: qualified ? Math.max(0, Math.min(100, Math.round(raw))) : 0,
    qualified,
    tier,
    matched: Array.from(new Set(matched)).slice(0, 6),
    missing: Array.from(new Set(missing)).slice(0, 4),
  };
}
