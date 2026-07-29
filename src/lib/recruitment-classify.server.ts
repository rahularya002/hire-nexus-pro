// Server-only: decide whether an email is recruitment-related, with a confidence score.

export type EmailKind =
  | "candidate_submission"
  | "resume_forward"
  | "job_application"
  | "interview_scheduling"
  | "recruiter_conversation"
  | "job_alert"
  | "bank_statement"
  | "invoice_receipt"
  | "travel"
  | "order_shipping"
  | "newsletter_promo"
  | "otp_security"
  | "other";

const RECRUITMENT_KINDS: EmailKind[] = [
  "candidate_submission",
  "resume_forward",
  "job_application",
  "interview_scheduling",
  "recruiter_conversation",
];

export type Extracted = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  current_company?: string | null;
  experience?: string | null;
  location?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  skills?: string[] | null;
  notes?: string | null;
};

export type Classification = {
  confidence: number;
  kind: EmailKind;
  reason: string;
  decision: "import" | "review" | "skip";
  signals: { heuristic: number; ai: number | null; hits: string[]; blocks: string[] };
  extracted: Extracted;
};

// Thresholds now live in src/lib/pipeline/config.ts (env-tunable).

/* ----------------------------- vocabularies ----------------------------- */

const JOB_BOARD_DOMAIN =
  /(naukri|linkedin|indeed|monster|shine\.com|timesjobs|hirist|cutshort|instahyre|iimjobs|updazz|workday|greenhouse|lever\.co|smartrecruiters|zohorecruit|recruit|jobs?\.|hiring|talent|staffing|consultanc|manpower|placement)/i;

const TRANSACTIONAL_DOMAIN =
  /(nse\.co\.in|bseindia|paytm|phonepe|razorpay|hdfcbank|icicibank|axisbank|sbi\.co|kotak|zerodha|groww|upstox|angelone|cdslindia|nsdl|amazon|flipkart|swiggy|zomato|uber|ola|irctc|makemytrip|goibibo|cleartrip|netflix|spotify|billdesk|bajaj|policybazaar|lic\.|insurance|creditcard|bankofbaroda|pnb|yesbank|dmart|bigbasket|blinkit|jio|airtel|vodafone|tatasky|electricity|gasbill|incometax|gst\.gov)/i;

const AUTOMATED_LOCAL =
  /^(alerts?|noreply|no-reply|donotreply|do-not-reply|notifications?|statements?|updates?|billing|invoices?|newsletter|mailer|marketing|news|otp|verify|security|txn|transaction|payments?|orders?|delivery|bookings?|tickets?)([._-].*)?$/i;

const RECRUIT_SUBJECT =
  /(resume|\bcv\b|curriculum vitae|candidate|profile|shortlist|applying|application for|applied for|interview|hiring|recruit|opening|vacancy|position|job description|\bjd\b|notice period|\bctc\b|offer letter|joining|screening|walk[- ]?in|referral|sourcing|placement)/i;

const NOISE_SUBJECT =
  /(statement|e-?statement|transaction|invoice|receipt|payment|paid|debited|credited|otp|one[- ]time password|verify your|password reset|order|delivered|shipment|tracking|ticket|pnr|itinerary|boarding|policy|premium|due date|bill|recharge|cashback|offer ends|sale|discount|coupon|newsletter|webinar|market wrap|nav |portfolio|holding|balance|tax|gst|form 16|salary slip|payslip)/i;

const RECRUIT_BODY =
  /(please find (my|the|attached)|sharing (my|the) (resume|cv|profile)|attached (is |herewith )?(my )?(resume|cv|profile)|candidate('s)? (profile|details)|total experience|relevant experience|notice period|current ctc|expected ctc|current company|willing to relocate|interview (scheduled|slot|round)|shortlisted|job description|for the (role|position) of|apply for|applying for)/i;

const NOISE_FILENAME =
  /(statement|invoice|receipt|bill|txn|transaction|payment|policy|premium|ticket|booking|itinerary|contract[\s_-]?note|holding|passbook|payslip|pay[\s_-]?slip|salary[\s_-]?slip|form[\s_-]?16|gst|tax|order|shipment|nse|bse|portfolio|ledger)/i;

const RESUME_FILENAME =
  /(resume|resum|cv[\s_.\-]|[\s_.\-]cv|curriculum|vitae|naukri|linkedin|profile|candidate|biodata|bio[\s_-]?data)/i;

const RESUME_SECTIONS = [
  /\bwork experience\b/i,
  /\bprofessional experience\b/i,
  /\beducation\b/i,
  /\bskills?\b/i,
  /\bprojects?\b/i,
  /\bcertificat/i,
  /\bcareer objective\b/i,
  /\bemployment\b/i,
  /\bqualification/i,
  /\bdeclaration\b/i,
];

function nameishFile(filename: string) {
  const base = filename.replace(/\.[^.]+$/, "");
  const words = base.replace(/[_\-.]+/g, " ").trim().split(/\s+/).filter(Boolean);
  return words.length >= 2 && words.length <= 4 && words.every((w) => /^[A-Za-z]{2,20}$/.test(w));
}

export type SignalInput = {
  fromEmail: string | null;
  fromName: string | null;
  toEmails: string[];
  myEmail: string | null;
  subject: string | null;
  bodyText: string;
  attachmentNames: string[];
  docText: string;
  threadKnown: boolean;
};

export type HeuristicResult = { score: number; hits: string[]; blocks: string[]; hardBlock: boolean };

/** Cheap multi-signal pre-score in the 0-100 range. */
export function heuristicScore(i: SignalInput): HeuristicResult {
  const hits: string[] = [];
  const blocks: string[] = [];
  let score = 40;
  let hardBlock = false;

  const [local = "", domain = ""] = (i.fromEmail ?? "").toLowerCase().split("@");

  if (TRANSACTIONAL_DOMAIN.test(domain)) {
    score -= 45;
    blocks.push("transactional sender domain");
    hardBlock = true;
  }
  if (AUTOMATED_LOCAL.test(local)) {
    score -= 20;
    blocks.push("automated sender address");
  }
  if (JOB_BOARD_DOMAIN.test(domain)) {
    score += 18;
    hits.push("job board / recruitment sender");
  }

  if (i.myEmail && i.toEmails.some((t) => t === i.myEmail)) {
    score += 6;
    hits.push("addressed directly to you");
  }
  if (i.toEmails.length > 8) {
    score -= 8;
    blocks.push("bulk recipients");
  }

  const subject = i.subject ?? "";
  if (RECRUIT_SUBJECT.test(subject)) {
    score += 18;
    hits.push("recruitment subject");
  }
  if (NOISE_SUBJECT.test(subject)) {
    score -= 30;
    blocks.push("transactional subject");
  }

  if (RECRUIT_BODY.test(i.bodyText)) {
    score += 16;
    hits.push("recruitment phrasing in body");
  }
  if (NOISE_SUBJECT.test(i.bodyText.slice(0, 1200))) {
    score -= 10;
    blocks.push("transactional wording in body");
  }

  const names = i.attachmentNames;
  if (names.length) {
    if (names.some((n) => RESUME_FILENAME.test(n))) {
      score += 16;
      hits.push("resume-style attachment name");
    } else if (names.some((n) => nameishFile(n))) {
      score += 10;
      hits.push("person-named attachment");
    }
    if (names.every((n) => NOISE_FILENAME.test(n))) {
      score -= 35;
      blocks.push("statement/invoice attachment");
    }
  }

  if (i.threadKnown) {
    score += 15;
    hits.push("thread already known as recruitment");
  }

  const doc = i.docText ?? "";
  if (doc.length > 400) {
    const sections = RESUME_SECTIONS.filter((re) => re.test(doc)).length;
    if (sections >= 3) {
      score += 22;
      hits.push("document has resume sections");
    } else if (sections === 2) {
      score += 12;
      hits.push("document partially resume-like");
    } else {
      score -= 12;
      blocks.push("document has no resume structure");
    }
    if (/\b(?:\+?\d[\d\s\-()]{8,})\b/.test(doc) && /@[\w.-]+\.\w+/.test(doc)) {
      score += 8;
      hits.push("document has personal contact details");
    }
  }

  // An automated address on a bank / marketplace / utility domain is never a
  // candidate applying for a job, no matter what the attachment looks like.
  if (hardBlock && AUTOMATED_LOCAL.test(local)) score = Math.min(score, 5);
  if (hardBlock && NOISE_SUBJECT.test(i.subject ?? "")) score = Math.min(score, 8);

  return { score: Math.max(0, Math.min(100, score)), hits, blocks, hardBlock };
}

/* --------------------------- shared field cleanup --------------------------- */

function cleanStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || /^(null|undefined|n\/a|na|none|unknown|-)$/i.test(t)) return null;
  return t;
}

export function cleanExtracted(e: Extracted): Extracted {
  return {
    name: cleanStr(e.name),
    email: cleanStr(e.email)?.toLowerCase() ?? null,
    phone: cleanStr(e.phone),
    role: cleanStr(e.role),
    current_company: cleanStr(e.current_company),
    experience: cleanStr(e.experience),
    location: cleanStr(e.location),
    salary_min: typeof e.salary_min === "number" ? e.salary_min : null,
    salary_max: typeof e.salary_max === "number" ? e.salary_max : null,
    skills: (e.skills ?? []).map((s) => cleanStr(s)).filter((s): s is string => !!s).slice(0, 30),
    notes: cleanStr(e.notes),
  };
}

