// Collapse repeated results for the same underlying person. Gmail retrieval can
// legitimately return several emails per candidate; the result list should show
// one card per person (the best-scoring one) instead of near-identical rows.

export type DedupeHit = {
  score?: number | null;
  origin?: string | null;
  resume_file_name?: string | null;
  extracted?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    role?: string | null;
  } | null;
};

const clean = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
const digits = (s: string | null | undefined) => (s ?? "").replace(/\D+/g, "");

/**
 * Stable identity for a result, most reliable signal first. The Gmail sender is
 * deliberately NOT used: one recruiter can forward many different candidates, so
 * collapsing on the sender would merge unrelated people.
 */
export function identityKey(hit: DedupeHit): string {
  const ex = hit.extracted ?? {};
  const email = clean(ex.email);
  if (email) return `email:${email}`;
  const phone = digits(ex.phone);
  if (phone.length >= 8) return `phone:${phone.slice(-10)}`;
  const name = clean(ex.name).replace(/\s+/g, " ");
  if (name) return `name:${name}|${clean(ex.role)}`;
  return "";
}

/**
 * Keep the strongest hit per person. Rows without any identity signal are always
 * kept, since collapsing them would hide genuinely different people.
 */
export function dedupeHits<T extends DedupeHit>(hits: T[]): T[] {
  const best = new Map<string, T>();
  const out: T[] = [];
  for (const hit of hits) {
    const key = identityKey(hit);
    if (!key) {
      out.push(hit);
      continue;
    }
    const prev = best.get(key);
    if (!prev) {
      best.set(key, hit);
      out.push(hit);
      continue;
    }
    const better =
      (hit.score ?? 0) > (prev.score ?? 0) ||
      ((hit.score ?? 0) === (prev.score ?? 0) && !prev.resume_file_name && !!hit.resume_file_name);
    if (better) {
      out[out.indexOf(prev)] = hit;
      best.set(key, hit);
    }
  }
  return out;
}
