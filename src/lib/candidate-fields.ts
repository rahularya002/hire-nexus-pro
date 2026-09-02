// Candidate-scoped field extraction with provenance.
//
// The previous behaviour matched role / experience / location / company / CTC
// with global regexes over "CV text + whole email body" and took the FIRST hit
// anywhere. On recruiter mails that list many people (tracker tables, forwarded
// digests) that meant every row inherited some other person's city, years and
// package — which is why Location was populated on 98% of stored rows while
// Role was empty on 72%.
//
// Here a value is only accepted when it comes from a place that actually
// belongs to this candidate:
//   cv_label   — an explicit label inside the resume ("Total Experience: 4 yrs")
//   cv_header  — the resume header/summary block (first lines, near contacts)
//   email_body — the mail body, and only when the body is trusted (single
//                candidate, no tracker table)
// Anything else stays null. Missing is better than wrong.
//
// Pure module: no network, no Gmail sender data, unit-testable.

export type FieldProvenance = "cv_label" | "cv_header" | "candidate_row" | "email_body" | "filename";

export type ScopedField<T> = { value: T | null; provenance: FieldProvenance | null };

export type ScopedFields = {
  role: ScopedField<string>;
  experience: ScopedField<string>;
  location: ScopedField<string>;
  company: ScopedField<string>;
  currentCtc: ScopedField<string>;
  expectedCtc: ScopedField<string>;
  noticePeriod: ScopedField<string>;
};

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{3,5}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}\b/;

const CITY_RE =
  /\b(bengaluru|bangalore|mumbai|bombay|navi mumbai|thane|pune|hyderabad|secunderabad|chennai|new delhi|delhi|ncr|noida|greater noida|ghaziabad|faridabad|gurgaon|gurugram|kolkata|ahmedabad|jaipur|indore|chandigarh|kochi|cochin|coimbatore|nagpur|lucknow|bhopal|vadodara|surat|thiruvananthapuram|mysuru|mysore|udaipur|ludhiana|kanpur|patna|guwahati|remote|singapore|dubai|abu dhabi|london|new york|san francisco|berlin|toronto|sydney)\b/i;

const ROLE_HEAD_RE =
  /\b(designer|developer|engineer|manager|analyst|architect|consultant|recruiter|accountant|executive|lead|director|specialist|technician|officer|assistant|associate|scientist|administrator|merchandiser|stylist|copywriter|marketer|tester|nurse|teacher|chef|supervisor|coordinator|planner|buyer|operator|artist|intern|trainee)\b/i;
const ROLE_STOPWORDS_RE =
  /\b(resume|curriculum|vitae|biodata|profile|summary|objective|contact|email|mobile|phone|address|education|skills?|experience|employment|certification|declaration|languages?|references?|hobbies|personal|details)\b/i;

/** Number with optional currency / unit, used for CTC values. */
const MONEY = String.raw`(?:₹|rs\.?|inr)?\s*\d{1,3}(?:[.,]\d{1,3})?\s*(?:lpa|lakhs?|lacs?|l|k|cr|crore|per annum|pa|p\.a\.?)?`;

const HEADER_LINES = 14;

function clean(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v
    .replace(/[\u2502|]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[:\-–\s]+/, "")
    .replace(/[.,;:]+$/, "")
    .trim();
  return s.length ? s.slice(0, 60) : null;
}

function titleCase(s: string) {
  return s.replace(/[A-Za-z][A-Za-z'’.-]*/g, (w) => (w[0] ?? "").toUpperCase() + w.slice(1).toLowerCase());
}

function lines(text: string): string[] {
  return text
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/**
 * The header/summary block of a resume: the first lines plus a small window
 * around the first contact detail (name/phone/mail usually sit together).
 */
function headerBlock(text: string): string {
  const ls = lines(text);
  const head = ls.slice(0, HEADER_LINES);
  const contactIdx = ls.findIndex((l) => EMAIL_RE.test(l) || PHONE_RE.test(l));
  const around = contactIdx >= 0 ? ls.slice(Math.max(0, contactIdx - 3), contactIdx + 5) : [];
  return [...head, ...around].join("\n");
}

function labelled(text: string, label: string, valuePattern: string): string | null {
  const re = new RegExp(String.raw`\b(?:${label})\b\s*(?:\(.{0,20}\))?\s*[:\-–]?\s*(${valuePattern})`, "i");
  return clean(re.exec(text)?.[1] ?? null);
}

/* --------------------------------- values --------------------------------- */

function normalizeYears(raw: string | null): string | null {
  if (!raw) return null;
  const m = /(\d{1,2}(?:\.\d)?)\s*(?:\+)?\s*(?:years?|yrs?|y\b)?/i.exec(raw);
  const years = m?.[1] ? Number(m[1]) : null;
  if (years == null || !Number.isFinite(years) || years <= 0 || years > 45) {
    const months = /(\d{1,2})\s*months?/i.exec(raw)?.[1];
    return months ? `${Number(months)} months` : null;
  }
  return `${years} years`;
}

function experienceFrom(text: string): string | null {
  const lab = labelled(
    text,
    "total\\s*(?:work\\s*)?experience|overall\\s*experience|years?\\s*of\\s*experience|work\\s*experience|experience|exp",
    String.raw`\d{1,2}(?:\.\d)?\s*\+?\s*(?:years?|yrs?|y\b)?(?:\s*\d{1,2}\s*months?)?`,
  );
  const fromLabel = normalizeYears(lab);
  if (fromLabel) return fromLabel;
  const inline = /(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:relevant\s+|total\s+|professional\s+|work\s+)?experience/i.exec(text);
  return normalizeYears(inline?.[0] ?? null);
}

function locationFrom(text: string): string | null {
  const lab = labelled(
    text,
    "current\\s*location|present\\s*location|preferred\\s*location|base\\s*location|location|city|residing\\s*(?:in|at)|based\\s*(?:in|at)|address|permanent\\s*address",
    String.raw`[A-Za-z][A-Za-z .,'’\-]{2,60}`,
  );
  if (lab) {
    const city = CITY_RE.exec(lab)?.[0];
    if (city) return titleCase(city);
  }
  return null;
}

function companyFrom(text: string): string | null {
  const lab =
    labelled(
      text,
      "current\\s*(?:company|employer|organisation|organization)|company|employer|organisation|organization|working\\s*(?:at|with)|currently\\s*(?:working\\s*)?(?:at|with)|employed\\s*(?:at|with)",
      String.raw`[A-Za-z][\w&.,'’\- ]{2,45}`,
    ) ?? null;
  if (!lab) return null;
  const value = lab.replace(/\b(?:as|since|from)\b.*$/i, "").trim();
  if (value.length < 3 || ROLE_STOPWORDS_RE.test(value)) return null;
  return titleCase(value);
}

function cleanRole(raw: string | null | undefined): string | null {
  const role = (raw ?? "")
    .replace(/\b(?:applying|applied)\s+for\b/gi, "")
    .replace(/\b(?:role|position|designation|profile)\b\s*[:\-–]?/gi, "")
    .replace(/^\s*(?:the|of|a|an|for|as)\b\s*/gi, "")
    .replace(/^\s*(?:the|of|a|an|for|as)\b\s*/gi, "")
    .replace(/[^A-Za-z0-9+#/&. -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!role || role.length < 3 || role.length > 60) return null;
  if (!ROLE_HEAD_RE.test(role) || ROLE_STOPWORDS_RE.test(role)) return null;
  return titleCase(role.toLowerCase());
}

function roleFrom(text: string): string | null {
  const lab = labelled(
    text,
    "designation|current\\s*(?:role|designation|position|title)|job\\s*title|position(?:\\s*applied\\s*for)?|role|profile\\s*summary|applying\\s*for",
    String.raw`[^\n|,;]{3,70}`,
  );
  const fromLabel = cleanRole(lab);
  if (fromLabel) return fromLabel;
  for (const line of lines(text)) {
    if (EMAIL_RE.test(line) || PHONE_RE.test(line) || CITY_RE.test(line)) continue;
    const role = cleanRole(line);
    if (role) return role;
  }
  return null;
}

function ctcFrom(text: string, kind: "current" | "expected"): string | null {
  const labels =
    kind === "current"
      ? "current\\s*(?:ctc|salary|compensation|package)|present\\s*(?:ctc|salary)|ctc\\s*\\(?\\s*current\\s*\\)?|ctc|salary|package"
      : "expected\\s*(?:ctc|salary|compensation|package)|expectation[s]?|desired\\s*(?:ctc|salary)|ctc\\s*expectation[s]?|exp\\.?\\s*ctc";
  const value = labelled(text, labels, MONEY);
  if (!value || !/\d/.test(value)) return null;
  // A bare "12" is meaningless; require a unit or a decimal amount.
  if (!/(lpa|lakh|lacs?|\bl\b|\bk\b|cr|crore|per annum|\bpa\b|p\.a|\.|₹|rs|inr)/i.test(value) && Number(value) > 100) {
    return null;
  }
  return value;
}

function noticeFrom(text: string): string | null {
  const value = labelled(
    text,
    "notice\\s*period|notice",
    String.raw`(?:immediate(?:ly)?|serving[^\n,;.|]{0,24}|negotiable|nil|none|\d{1,3}\s*(?:days?|weeks?|months?)|\d{1,2}\s*(?:day|week|month))`,
  );
  if (value) return titleCase(value);
  if (/\bimmediate(?:ly)?\s*(?:joine[re]|available|availability|joining)\b/i.test(text)) return "Immediate";
  return null;
}

/* -------------------------------- extraction -------------------------------- */

export type ScopeInput = {
  /** Resume text for THIS candidate (may be empty for scanned/absent CVs). */
  docText: string;
  /** Cleaned email body. */
  bodyText: string;
  /**
   * Whether the body may donate values. False when the mail lists several
   * candidates (tracker table / digest) — then body values belong to someone
   * else as often as not.
   */
  bodyTrusted: boolean;
};

function take<T>(
  primary: T | null,
  primaryProvenance: FieldProvenance,
  secondary: T | null,
  secondaryProvenance: FieldProvenance,
): ScopedField<T> {
  if (primary != null) return { value: primary, provenance: primaryProvenance };
  if (secondary != null) return { value: secondary, provenance: secondaryProvenance };
  return { value: null, provenance: null };
}

/** Extract every refinable field from candidate-owned text only. */
export function extractScopedFields(input: ScopeInput): ScopedFields {
  const doc = input.docText ?? "";
  const header = headerBlock(doc);
  const body = input.bodyTrusted ? (input.bodyText ?? "") : "";

  // Labels are trusted anywhere inside the resume; unlabelled matches only in
  // the header/summary block.
  const roleDoc = roleFrom(header) ?? cleanRole(labelled(doc, "designation|current\\s*role|job\\s*title", String.raw`[^\n|,;]{3,70}`));
  const expDoc = experienceFrom(doc);
  const locDoc = locationFrom(doc) ?? (CITY_RE.test(header) ? titleCase(CITY_RE.exec(header)![0]) : null);
  const compDoc = companyFrom(doc);
  const curDoc = ctcFrom(doc, "current");
  const expCtcDoc = ctcFrom(doc, "expected");
  const noticeDoc = noticeFrom(doc);

  return {
    role: take(roleDoc, "cv_header", body ? roleFrom(body) : null, "email_body"),
    experience: take(expDoc, "cv_label", body ? experienceFrom(body) : null, "email_body"),
    location: take(locDoc, "cv_header", body ? locationFrom(body) : null, "email_body"),
    company: take(compDoc, "cv_label", body ? companyFrom(body) : null, "email_body"),
    currentCtc: take(curDoc, "cv_label", body ? ctcFrom(body, "current") : null, "email_body"),
    expectedCtc: take(expCtcDoc, "cv_label", body ? ctcFrom(body, "expected") : null, "email_body"),
    noticePeriod: take(noticeDoc, "cv_label", body ? noticeFrom(body) : null, "email_body"),
  };
}

/** Convenience: plain values without provenance. */
export function scopedValues(f: ScopedFields) {
  return {
    role: f.role.value,
    experience: f.experience.value,
    location: f.location.value,
    company: f.company.value,
    currentCtc: f.currentCtc.value,
    expectedCtc: f.expectedCtc.value,
    noticePeriod: f.noticePeriod.value,
  };
}
