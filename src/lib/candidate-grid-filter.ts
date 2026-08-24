// Pure filter predicate for the Candidate Grid. Extracted from the route so the
// filter combinations (and their "unknown value" behaviour) can be unit tested
// without rendering the grid.
import type { GridFilters } from "./candidate-grid-session";

export type FilterableCandidate = {
  name: string;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  current_company?: string | null;
  previous_companies?: (string | null | undefined)[] | null;
  location?: string | null;
  industry?: string | null;
  notice_period?: string | null;
  skills?: (string | null | undefined)[] | null;
  experience?: string | null;
  relevant_experience?: string | null;
  current_ctc?: number | null;
  expected_ctc?: number | null;
  salary_min?: number | null;
  salary_max?: number | null;
  source?: string | null;
  status?: string | null;
  owner_id?: string | null;
  source_client_id?: string | null;
};

/** First number in any of the given free-text experience fields. */
export function yearsOf(...vals: (string | null | undefined)[]): number | null {
  for (const v of vals) {
    const m = (v ?? "").match(/(\d{1,2}(?:\.\d)?)/);
    if (m) return Number(m[1]);
  }
  return null;
}

/** Blank and non-numeric input must behave as "no constraint", never as 0. */
const num = (s: string): number | null => {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

const has = (v: string | null | undefined, term: string) =>
  !!v && v.toLowerCase().includes(term.toLowerCase().trim());

export function matchesGridFilters(
  c: FilterableCandidate,
  f: GridFilters,
  myId: string | null,
): boolean {
  const needle = f.q.toLowerCase().trim();
  if (needle) {
    const hit = [c.name, c.role, c.location, c.email, c.current_company, c.phone, c.industry, ...(c.skills ?? [])]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(needle));
    if (!hit) return false;
  }
  if (f.role && !has(c.role, f.role)) return false;
  if (f.company) {
    const inCurrent = has(c.current_company, f.company);
    const inPast = (c.previous_companies ?? []).some((p) => has(p, f.company));
    if (!inCurrent && !inPast) return false;
  }
  if (f.location && !has(c.location, f.location)) return false;
  if (f.industry && !has(c.industry, f.industry)) return false;
  if (f.noticePeriod && !has(c.notice_period, f.noticePeriod)) return false;

  const wantedSkills = f.skills.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (wantedSkills.length) {
    const own = (c.skills ?? []).filter(Boolean).map((s) => String(s).toLowerCase());
    if (!wantedSkills.every((s) => own.some((o) => o.includes(s)))) return false;
  }

  const minY = num(f.minYears);
  if (minY != null) {
    const y = yearsOf(c.experience, c.relevant_experience);
    if (y == null || y < minY) return false;
  }

  const ctcMin = num(f.ctcMin);
  const ctcMax = num(f.ctcMax);
  if (ctcMin != null || ctcMax != null) {
    const cur = c.current_ctc ?? c.salary_min ?? c.salary_max ?? null;
    if (cur == null) return false;
    if (ctcMin != null && cur < ctcMin) return false;
    if (ctcMax != null && cur > ctcMax) return false;
  }

  const expMax = num(f.expectedMax);
  if (expMax != null) {
    const exp = c.expected_ctc ?? c.salary_max ?? null;
    if (exp == null || exp > expMax) return false;
  }

  if (f.source !== "all" && c.source !== f.source) return false;
  if (f.status !== "all" && c.status !== f.status) return false;
  if (f.owner === "mine" && c.owner_id !== myId) return false;
  if (f.owner === "unassigned" && c.owner_id) return false;
  if (f.client === "unassigned" && c.source_client_id) return false;
  if (f.client !== "all" && f.client !== "unassigned" && c.source_client_id !== f.client) return false;
  return true;
}
