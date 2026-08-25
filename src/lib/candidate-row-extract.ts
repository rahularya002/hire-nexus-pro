// Extract candidate rows from recruiter submission tables pasted into emails.
// These rows are candidate evidence; Gmail sender fields are never consulted here.

export type CandidateRowFields = {
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  current_company: string | null;
  experience: string | null;
  location: string | null;
};

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{3,5}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}\b/;
const YEARS_RE = /(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years?|yrs?)\b/i;
const CITY_RE = /\b(bengaluru|bangalore|mumbai|pune|hyderabad|chennai|delhi|new delhi|noida|gurgaon|gurugram|kolkata|ahmedabad|jaipur|indore|chandigarh|kochi|coimbatore|nagpur|lucknow|bhopal|vadodara|surat|thiruvananthapuram|mysuru|mysore|remote|udaipur|bangalore)\b/gi;
const CTC_BOUNDARY_RE = /\b(?:\d{1,3}(?:\.\d{1,2})?\s*(?:lpa|lakh|lacs?|k\b)|\d{1,3}\s*%|immediate|\d+\s*days?|\d+\s*months?)\b/i;

const CONTACT_HEADER_RE = /candidate\s*name.{0,80}(?:contact|phone|mobile).{0,80}email/i;
const BAD_NAME_RE = /\b(candidate|contact|email|profile|resume|current|preferred|location|organization|organisation|ctc|notice|period|date|position|applied)\b/i;

const digits = (s: string | null | undefined) => (s ?? "").replace(/\D+/g, "");
const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

function titleCase(s: string) {
  return clean(s).replace(/\b[A-Za-z][A-Za-z'’.-]*/g, (w) => {
    const first = w[0];
    return first ? first.toUpperCase() + w.slice(1).toLowerCase() : w;
  });
}

function cleanName(s: string): string | null {
  const stripped = clean(s)
    .replace(/^\d+\s+/, "")
    .replace(/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\s+/, "")
    .replace(/[^A-Za-z'’ .-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = stripped.split(" ").filter((w) => /^[A-Za-z][A-Za-z'’.-]{1,24}$/.test(w));
  if (words.length < 2 || words.length > 5) return null;
  const name = words.join(" ");
  return BAD_NAME_RE.test(name) ? null : titleCase(name);
}

function cleanRole(s: string | null | undefined): string | null {
  const role = clean(s)
    .replace(/^(?:for|as)\s+/i, "")
    .replace(CTC_BOUNDARY_RE, "")
    .replace(/[^A-Za-z/&+ -]+$/g, "")
    .trim();
  if (!role || role.length < 2 || role.length > 60) return null;
  if (/^(na|n\/a|none|unknown|candidate|profile)$/i.test(role)) return null;
  return titleCase(role);
}

function parseTail(tail: string): Pick<CandidateRowFields, "role" | "current_company" | "experience" | "location"> {
  const text = clean(tail);
  const years = YEARS_RE.exec(text);
  const beforeYears = years ? text.slice(0, years.index).trim() : text;
  const afterYears = years ? text.slice(years.index + years[0].length).trim() : "";
  const role = cleanRole(beforeYears.split(CTC_BOUNDARY_RE)[0] ?? beforeYears);
  const companyRaw = afterYears.split(CTC_BOUNDARY_RE)[0] ?? "";
  const company = clean(companyRaw.replace(CITY_RE, "").trim());
  const cities = Array.from(text.matchAll(CITY_RE)).map((m) => titleCase(m[0]));
  return {
    role,
    current_company: company && company.length <= 45 ? titleCase(company) : null,
    experience: years?.[1] ? `${Number(years[1])} years` : null,
    location: cities[0] ?? null,
  };
}

function parseCandidateLine(line: string): CandidateRowFields | null {
  const emailMatch = EMAIL_RE.exec(line);
  const phoneMatch = PHONE_RE.exec(line);
  if (!emailMatch || !phoneMatch) return null;
  const email = emailMatch[0].toLowerCase();
  const phone = phoneMatch[0].trim();
  const firstContact = Math.min(emailMatch.index, phoneMatch.index);
  const name = cleanName(line.slice(0, firstContact));
  if (!name) return null;
  const tailStart = Math.max(emailMatch.index + email.length, phoneMatch.index + phone.length);
  const tail = line.slice(tailStart);
  return { name, email, phone, ...parseTail(tail) };
}

export function extractCandidateRows(text: string | null | undefined): CandidateRowFields[] {
  const normalized = (text ?? "").replace(/\r/g, "\n");
  const likelyTable = CONTACT_HEADER_RE.test(normalized) || /\bCandidate\s+name\b/i.test(normalized);
  const lines = normalized.split("\n").map(clean).filter(Boolean);
  const rows: CandidateRowFields[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    const next = lines[i + 1] ?? "";
    const candidates = likelyTable ? [line, `${line} ${next}`] : [line];
    for (const candidate of candidates) {
      const row = parseCandidateLine(candidate);
      if (!row) continue;
      if (!rows.some((r) => r.email === row.email || digits(r.phone) === digits(row.phone))) rows.push(row);
      break;
    }
  }
  return rows.slice(0, 25);
}

function sameName(a: string | null | undefined, b: string | null | undefined) {
  const ca = clean(a).toLowerCase();
  const cb = clean(b).toLowerCase();
  return !!ca && !!cb && (ca === cb || ca.includes(cb) || cb.includes(ca));
}

export function findCandidateRow(
  rows: CandidateRowFields[],
  identity: { email?: string | null; phone?: string | null; name?: string | null },
): CandidateRowFields | null {
  const email = clean(identity.email).toLowerCase();
  if (email) {
    const hit = rows.find((r) => clean(r.email).toLowerCase() === email);
    if (hit) return hit;
  }
  const phone = digits(identity.phone);
  if (phone.length >= 8) {
    const hit = rows.find((r) => digits(r.phone).endsWith(phone.slice(-10)) || phone.endsWith(digits(r.phone).slice(-10)));
    if (hit) return hit;
  }
  const nameHit = rows.find((r) => sameName(r.name, identity.name));
  if (nameHit) return nameHit;
  return rows.length === 1 ? (rows[0] ?? null) : null;
}
