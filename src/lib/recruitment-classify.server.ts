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

/** What the email primarily *contains*, which is what decides importability. */
export type ArtifactType =
  | "candidate_profile"
  | "candidate_plus_conversation"
  | "recruitment_conversation"
  | "job_description"
  | "interview_feedback"
  | "administrative";

export const ARTIFACT_TYPES: ArtifactType[] = [
  "candidate_profile",
  "candidate_plus_conversation",
  "recruitment_conversation",
  "job_description",
  "interview_feedback",
  "administrative",
];

export function isCandidateArtifact(a: ArtifactType | null | undefined) {
  return a === "candidate_profile" || a === "candidate_plus_conversation";
}

export function normalizeArtifact(v: unknown): ArtifactType {
  return typeof v === "string" && (ARTIFACT_TYPES as string[]).includes(v)
    ? (v as ArtifactType)
    : "administrative";
}

export type Classification = {
  /** Candidate confidence: how sure we are an importable candidate profile exists. */
  confidence: number;
  kind: EmailKind;
  artifact: ArtifactType;
  reason: string;
  decision: "import" | "review" | "skip";
  signals: {
    heuristic: number;
    ai: number | null;
    hits: string[];
    blocks: string[];
    candidateEvidence?: number;
    uncertainty?: string | null;
  };
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

const RESUME_EXT = /\.(pdf|docx?|rtf|odt)$/i;

/**
 * Attachment names that describe a ROLE, not a person. A file called
 * "Job Description - Manager Social.docx.pdf" must never count as a resume,
 * even though it is a PDF full of skills and qualifications.
 */
const JD_FILENAME =
  /(job[\s_.\-]?desc|\bjd\b|jd[\s_.\-]|[\s_.\-]jd|requirement|mandate|role[\s_.\-]?brief|hiring|opening|vacancy|position[s]?[\s_.\-]|budget|spec(ification)?[\s_.\-]?sheet|tracker)/i;

/** Parsed document text that reads like a job description rather than a CV. */
const JD_DOC =
  /(roles? (and|&) responsibilit|key responsibilit|desired candidate profile|candidate profile:|job (title|description|purpose|summary|location|specification)|no\.? of (openings|positions|vacanc)|number of positions|experience required|qualification required|we are looking for|about the (role|company)|reporting to|budget[:\s]|ctc range|salary range|shift timing|hiring for|position overview|job requirements?)/i;

/** Phrases that mean "a candidate is attached / included here". */
const CANDIDATE_SHARE_PHRASE =
  /(please find (my |the |attached)|pfa\b|attached (is |herewith |please find )?(the |my )?(resume|cv|profile|candidate)|sharing (my |the |his |her )?(resume|cv|profile|candidate)|kindly find (the |my )?(resume|cv|profile)|candidate (profile|details|summary)|submitting (my |the )?(resume|cv|profile|candidature)|forwarding (the |his |her )?(resume|cv|profile)|herewith my (resume|cv)|enclosed (is )?(my )?(resume|cv))/i;

/** Phrases that mean "this is a requirement/JD", not a person. */
const JD_PHRASE =
  /(we are hiring|job description|\bjd\b|hiring for|urgent(ly)? (require|hiring|opening)|open(ing)?s? (for|at)\b|requirement[s]? (for|:)|please share (profiles|resumes|candidates)|looking for candidates|position[s]? (open|available)|roles? and responsibilities|desired candidate profile|no of (openings|positions))/i;

/** Phrases typical of interview feedback / evaluation mails. */
const FEEDBACK_PHRASE =
  /(interview feedback|feedback (on|for) the (candidate|interview)|round \d (feedback|result)|(selected|rejected|on hold) (in|after) the (interview|round)|evaluation (form|summary)|technical round feedback|not a (good )?fit for (this|the) role)/i;

/** Conversation-only recruiter chatter. */
const CONVERSATION_PHRASE =
  /(following up|any update|gentle reminder|thanks for (your|the) (mail|reply|update)|as discussed|scheduled (the|an) interview|available slot|please confirm the (slot|time)|shall we connect|call you at)/i;

const BODY_CONTACT_BLOCK = /@[\w.-]+\.\w{2,}/.source;

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

export type CandidateEvidence = {
  /** 0-100: how strongly this email looks like it contains an importable candidate. */
  score: number;
  hits: string[];
  against: string[];
  /** Best deterministic guess at the artifact, before any AI. */
  artifact: ArtifactType;
  /** Set when we genuinely cannot tell whether a candidate is in here. */
  uncertainty: string | null;
};

function resumeSectionCount(doc: string) {
  return RESUME_SECTIONS.filter((re) => re.test(doc)).length;
}

/**
 * The core question: does this email contain a candidate profile we can import?
 * Deliberately independent of "is this recruitment related" — a JD or a recruiter
 * conversation is recruitment, but produces no candidate.
 */
export function candidateEvidence(i: SignalInput): CandidateEvidence {
  const hits: string[] = [];
  const against: string[] = [];
  let score = 0;
  let uncertainty: string | null = null;

  const subject = i.subject ?? "";
  const body = i.bodyText ?? "";
  const doc = i.docText ?? "";
  const names = i.attachmentNames ?? [];

  const docAttachments = names.filter((n) => RESUME_EXT.test(n));
  // A JD-named file is evidence of a role, never of a person — exclude it from
  // every resume-ish bucket before anything else is scored.
  const jdNamed = names.filter((n) => JD_FILENAME.test(n));
  const nonJdDocs = docAttachments.filter((n) => !JD_FILENAME.test(n));
  const resumeNamed = nonJdDocs.filter((n) => RESUME_FILENAME.test(n));
  const personNamed = nonJdDocs.filter((n) => nameishFile(n));
  const noiseNamed = names.filter((n) => NOISE_FILENAME.test(n));
  const docLooksLikeJd = JD_DOC.test(doc.slice(0, 6000));
  const allAttachmentsAreJds = !!names.length && jdNamed.length === names.length;

  if (resumeNamed.length) {
    score += 45;
    hits.push("resume-named document attached");
  } else if (personNamed.length) {
    score += 32;
    hits.push("person-named document attached");
  } else if (nonJdDocs.length) {
    score += 12;
    hits.push("document attached");
  }
  if (jdNamed.length) {
    score -= allAttachmentsAreJds ? 35 : 15;
    against.push(
      allAttachmentsAreJds
        ? "every attachment is a job description, not a CV"
        : "some attachments are job descriptions",
    );
  }
  if (noiseNamed.length && noiseNamed.length === names.length && names.length) {
    score -= 40;
    against.push("attachments look like statements or invoices");
  }

  // Parsed attachment text is the strongest evidence of an actual resume.
  if (doc.length > 400) {
    const sections = resumeSectionCount(doc);
    const hasContact = new RegExp(BODY_CONTACT_BLOCK).test(doc) && /\b(?:\+?\d[\d\s\-()]{8,})\b/.test(doc);
    if (docLooksLikeJd) {
      // JDs list skills, education and experience too. Section counting cannot
      // tell them apart from a CV, so we refuse to award resume credit here.
      score -= 20;
      against.push("attachment text reads as a job description");
    } else if (sections >= 3) {
      score += 35;
      hits.push("attachment parses as a resume");
    } else if (sections === 2 && hasContact) {
      score += 22;
      hits.push("attachment partially resume-shaped");
    } else if (sections <= 1) {
      score -= 18;
      against.push("attachment has no resume structure");
    }
    if (hasContact && !docLooksLikeJd) {
      score += 10;
      hits.push("attachment carries personal contact details");
    }
  } else if (nonJdDocs.length && doc.trim().length < 120) {
    // We have a document we could not read — a scanned or corrupted CV is exactly
    // the case a human should look at.
    uncertainty = "attachment could not be read (possibly scanned or corrupted)";
    against.push("attachment text unreadable");
  }

  if (CANDIDATE_SHARE_PHRASE.test(body) || CANDIDATE_SHARE_PHRASE.test(subject)) {
    score += 22;
    hits.push("email says a candidate/resume is included");
  }

  // Resume pasted straight into the body, no attachment at all.
  const bodySections = resumeSectionCount(body);
  const bodyContact =
    new RegExp(BODY_CONTACT_BLOCK).test(body) && /\b(?:\+?\d[\d\s\-()]{8,})\b/.test(body);
  if (!docAttachments.length && bodySections >= 3 && bodyContact) {
    score += 30;
    hits.push("resume appears pasted into the email body");
    uncertainty = uncertainty ?? "resume looks pasted into the body rather than attached";
  } else if (!docAttachments.length && bodySections >= 2 && bodyContact) {
    score += 16;
    uncertainty = uncertainty ?? "possible profile written in the email body";
  }

  const jd = JD_PHRASE.test(subject) || JD_PHRASE.test(body.slice(0, 2500));
  const feedback = FEEDBACK_PHRASE.test(subject) || FEEDBACK_PHRASE.test(body.slice(0, 2500));
  const chatter = CONVERSATION_PHRASE.test(body.slice(0, 2500));

  // Several roles / openings / budgets in one mail is a requirement blast, not a
  // person. Count the strongest repeated role markers in body + subject.
  const roleMarkers = (subject + "\n" + body.slice(0, 4000)).match(
    /(no\.? of positions|openings?\b|vacanc(y|ies)|designation|budget|fixed ctc|ctc range|mandate)/gi,
  );
  const multiRole = (roleMarkers?.length ?? 0) >= 3;
  if (multiRole) {
    score -= 22;
    against.push("multiple roles / openings listed in one email");
  }

  if (jd || docLooksLikeJd || allAttachmentsAreJds) {
    score -= 20;
    against.push("reads like a job description / requirement");
  }
  if (feedback) {
    score -= 15;
    against.push("reads like interview feedback");
  }

  // Hard ceiling: when the mail is dominated by requirement signals and carries
  // no resume-named / person-named document and no personal contact block, there
  // is no importable person here no matter how resume-shaped the words look.
  const personalEvidence =
    resumeNamed.length > 0 ||
    personNamed.length > 0 ||
    CANDIDATE_SHARE_PHRASE.test(body) ||
    CANDIDATE_SHARE_PHRASE.test(subject);
  const jdDominant = allAttachmentsAreJds || docLooksLikeJd || multiRole || (jd && !personalEvidence);
  if (jdDominant && !personalEvidence) score = Math.min(score, 22);

  score = Math.max(0, Math.min(100, score));

  // Deterministic artifact guess.
  let artifact: ArtifactType;
  if (jdDominant && !personalEvidence) {
    artifact = "job_description";
  } else if (score >= 55) {
    artifact = chatter || jd || feedback ? "candidate_plus_conversation" : "candidate_profile";
  } else if (feedback) {
    artifact = "interview_feedback";
  } else if (jd) {
    artifact = "job_description";
  } else if (RECRUIT_SUBJECT.test(subject) || RECRUIT_BODY.test(body) || chatter || i.threadKnown) {
    artifact = "recruitment_conversation";
  } else {
    artifact = "administrative";
  }

  // A requirement mail is never a "we cannot tell" case — do not send it to a human.
  if (jdDominant && !personalEvidence) uncertainty = null;

  // Mixed attachment types are ambiguous on purpose.
  if (names.length > 1 && resumeNamed.length && names.length !== docAttachments.length) {
    uncertainty = uncertainty ?? "mixed attachment types — unclear which is the CV";
  }

  return { score, hits, against, artifact, uncertainty };
}

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

