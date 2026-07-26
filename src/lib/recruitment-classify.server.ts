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

export const IMPORT_THRESHOLD = 80;
export const REVIEW_THRESHOLD = 45;

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

/* ------------------------------- AI pass ------------------------------- */

type AiResult = {
  is_recruitment?: boolean | null;
  confidence?: number | null;
  email_kind?: string | null;
  reason?: string | null;
} & Extracted;

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

async function aiClassify(i: SignalInput): Promise<AiResult | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;

  const context = [
    `From: ${i.fromName ?? ""} <${i.fromEmail ?? "unknown"}>`,
    `To: ${i.toEmails.slice(0, 10).join(", ")}`,
    `Subject: ${i.subject ?? ""}`,
    `Attachments: ${i.attachmentNames.join(", ") || "none"}`,
    i.threadKnown ? "Thread context: earlier messages in this thread were recruitment-related." : "",
    "",
    "--- EMAIL BODY ---",
    i.bodyText.slice(0, 4000),
    "",
    "--- ATTACHED DOCUMENT TEXT ---",
    (i.docText ?? "").slice(0, 12000),
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You classify a recruiter's email. Use the WHOLE context: sender, recipients, subject, body, attachment names, thread hint and attached document text. Decide whether this email is part of recruitment/hiring work (a candidate resume or CV, a candidate submission or forward, a job application, interview scheduling, or a recruiter/candidate conversation). Emails about bank or brokerage statements, invoices, receipts, payments, utility bills, taxes, OTP or security codes, orders, shipping, travel tickets, newsletters and promotions are NOT recruitment. Never call a document a resume just because it is a PDF. Return confidence 0-100 as how certain you are that this is recruitment-related, and be conservative: use 40-70 when genuinely ambiguous. Extract candidate fields only when a person's resume/profile is present, else leave them null. Reply ONLY through the classify_email tool.",
          },
          { role: "user", content: context },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_email",
              description: "Classify a recruiter email and extract candidate fields when present.",
              parameters: {
                type: "object",
                properties: {
                  is_recruitment: { type: "boolean" },
                  confidence: { type: "number" },
                  email_kind: {
                    type: "string",
                    enum: [
                      "candidate_submission",
                      "resume_forward",
                      "job_application",
                      "interview_scheduling",
                      "recruiter_conversation",
                      "job_alert",
                      "bank_statement",
                      "invoice_receipt",
                      "travel",
                      "order_shipping",
                      "newsletter_promo",
                      "otp_security",
                      "other",
                    ],
                  },
                  reason: { type: "string" },
                  name: { type: ["string", "null"] },
                  email: { type: ["string", "null"] },
                  phone: { type: ["string", "null"] },
                  role: { type: ["string", "null"] },
                  current_company: { type: ["string", "null"] },
                  experience: { type: ["string", "null"] },
                  location: { type: ["string", "null"] },
                  salary_min: { type: ["number", "null"] },
                  salary_max: { type: ["number", "null"] },
                  skills: { type: ["array", "null"], items: { type: "string" } },
                  notes: { type: ["string", "null"] },
                },
                required: [
                  "is_recruitment","confidence","email_kind","reason","name","email","phone","role",
                  "current_company","experience","location","salary_min","salary_max","skills","notes",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "classify_email" } },
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
    };
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    return args ? (JSON.parse(args) as AiResult) : null;
  } catch {
    return null;
  }
}

function normalizeKind(v: unknown): EmailKind {
  const k = typeof v === "string" ? (v as EmailKind) : "other";
  const all: EmailKind[] = [...RECRUITMENT_KINDS, "job_alert", "bank_statement", "invoice_receipt", "travel", "order_shipping", "newsletter_promo", "otp_security", "other"];
  return all.includes(k) ? k : "other";
}

/** Fuse heuristics + AI into a single score and routing decision. */
export async function classifyEmail(i: SignalInput): Promise<Classification> {
  const h = heuristicScore(i);

  // Obvious noise: don't spend an AI call at all.
  if (h.score <= 12) {
    return {
      confidence: h.score,
      kind: "other",
      reason: h.blocks[0] ? `Looks like non-recruitment mail — ${h.blocks[0]}.` : "No recruitment signals found.",
      decision: "skip",
      signals: { heuristic: h.score, ai: null, hits: h.hits, blocks: h.blocks },
      extracted: cleanExtracted({}),
    };
  }

  const ai = await aiClassify(i);
  const kind = normalizeKind(ai?.email_kind);
  const isRecruitKind = RECRUITMENT_KINDS.includes(kind);
  const aiConf =
    typeof ai?.confidence === "number" ? Math.max(0, Math.min(100, Math.round(ai.confidence))) : null;

  let score: number;
  if (aiConf == null) {
    // No AI verdict — heuristics alone can never clear the import bar.
    score = Math.min(h.score, IMPORT_THRESHOLD - 1);
  } else {
    score = Math.round(aiConf * 0.7 + h.score * 0.3);
    if (ai?.is_recruitment === false) score = Math.min(score, 30);
    if (!isRecruitKind) score = Math.min(score, kind === "job_alert" ? 40 : 25);
    if (h.blocks.length >= 2) score = Math.min(score, 55);
    if (h.hits.length >= 3 && isRecruitKind) score = Math.min(100, score + 5);
  }
  score = Math.max(0, Math.min(100, score));

  const extracted = cleanExtracted(ai ?? {});
  const hasPerson = !!extracted.name || !!extracted.email || (extracted.skills?.length ?? 0) > 0;

  let decision: Classification["decision"] =
    score >= IMPORT_THRESHOLD ? "import" : score >= REVIEW_THRESHOLD ? "review" : "skip";
  // Never auto-create a person we know nothing about.
  if (decision === "import" && !hasPerson) decision = "review";

  const reason =
    cleanStr(ai?.reason) ??
    (h.hits[0] ? `Recruitment signals: ${h.hits.slice(0, 2).join(", ")}.` : "Not enough recruitment evidence.");

  return {
    confidence: score,
    kind,
    reason,
    decision,
    signals: { heuristic: h.score, ai: aiConf, hits: h.hits, blocks: h.blocks },
    extracted,
  };
}