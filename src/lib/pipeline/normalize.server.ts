// NORMALIZATION stage — hashing, body cleaning and deterministic (AI-free) field
// extraction. Nothing in this file ever calls a model.
import {
  candidateNameFromFile,
  candidateNameFromText,
  sanitizeCandidateIdentity,
  senderLooksLikeCandidate,
} from "../candidate-identity";
import { extractCandidateRows, findCandidateRow } from "../candidate-row-extract";
import { extractCvName } from "../cv-name";
import type { Extracted } from "../recruitment-classify.server";
import { AI_MAX_BODY_CHARS, COVERAGE_TARGETS, type Facet } from "./config";
import type { FieldCoverage } from "./types";

/* -------------------------------- hashing -------------------------------- */

const HEX = "0123456789abcdef";

function toHex(buf: ArrayBuffer): string {
  const view = new Uint8Array(buf);
  let out = "";
  for (const b of view) out += HEX[b >> 4] + HEX[b & 15];
  return out;
}

export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return toHex(await crypto.subtle.digest("SHA-256", copy.buffer));
}

export async function sha256Text(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

/* ---------------------------- body preprocessing ---------------------------- */

const QUOTE_MARKERS = [
  /^-{2,}\s*original message\s*-{2,}/im,
  /^_{5,}\s*$/m,
  /^on .{0,120}\bwrote:\s*$/im,
  /^from:\s.+\nsent:\s/im,
  /^>{1,}\s/m,
];

const FOOTER_MARKERS = [
  /this (e-?mail|message) (and any attachments? )?(is|are) (confidential|intended)/i,
  /please consider the environment before printing/i,
  /\bunsubscribe\b/i,
  /if you no longer wish to receive/i,
  /disclaimer\s*:/i,
  /^--\s*$/m,
  /^sent from my /im,
];

/** Strip HTML, quoted replies, signatures, disclaimers and tracking noise. */
export function cleanBodyText(input: string): string {
  let t = input ?? "";

  if (/<[a-z!/][\s\S]*>/i.test(t)) {
    t = t
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, " ");
  }

  t = t
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"');

  // Tracking pixels / long tracker URLs add tokens and no signal.
  t = t.replace(/https?:\/\/\S{80,}/g, " ");

  for (const re of [...QUOTE_MARKERS, ...FOOTER_MARKERS]) {
    const m = re.exec(t);
    if (m && m.index > 120) t = t.slice(0, m.index);
  }

  return t.replace(/[ \t\u00a0]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, AI_MAX_BODY_CHARS);
}

/* ------------------------- deterministic extraction ------------------------- */

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const EMAIL_GLOBAL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const PHONE_RE = /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{3,5}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}\b/;
const PHONE_GLOBAL_RE = /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{3,5}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}\b/g;
const LINKEDIN_RE = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[a-z0-9\-_%]{3,}/i;
const YEARS_RE = /(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years?|yrs?)\b[^.\n]{0,30}(?:experience|exp\b)?/i;
const CTC_RE = /(?:ctc|salary|package|compensation)[^\n]{0,40}?(\d{1,3}(?:\.\d{1,2})?)\s*(?:-|to|–)?\s*(\d{1,3}(?:\.\d{1,2})?)?\s*(lpa|lakh|lacs?|l\b)/i;
const COMPANY_RE = /\b(?:currently (?:working )?(?:at|with)|working (?:at|with)|employed (?:at|with)|company\s*[:\-])\s*([A-Z][\w&.,'\- ]{2,40})/;
const LOCATION_RE =
  /\b(bengaluru|bangalore|mumbai|pune|hyderabad|chennai|delhi|new delhi|noida|gurgaon|gurugram|kolkata|ahmedabad|jaipur|indore|chandigarh|kochi|coimbatore|nagpur|lucknow|bhopal|vadodara|surat|thiruvananthapuram|mysuru|mysore|remote|singapore|dubai|london|new york|san francisco|berlin|toronto|sydney)\b/i;
const ROLE_LABEL_RE =
  /\b(?:designation|current\s+role|current\s+designation|job\s+title|profile|position(?:\s+applied\s+for)?|role)\s*[:\-–]\s*([^\n|,;]{2,80})/i;

const SKILL_DICTIONARY = [
  "javascript","typescript","react","react native","next.js","node.js","express","angular","vue","svelte",
  "python","django","flask","fastapi","java","spring","spring boot","kotlin","swift","objective-c",
  "c++","c#",".net","go","golang","rust","ruby","rails","php","laravel","scala","elixir",
  "sql","postgresql","mysql","mongodb","redis","elasticsearch","cassandra","dynamodb","snowflake","bigquery",
  "aws","azure","gcp","docker","kubernetes","terraform","ansible","jenkins","ci/cd","github actions",
  "graphql","rest api","microservices","kafka","rabbitmq","spark","hadoop","airflow","dbt","etl",
  "machine learning","deep learning","nlp","computer vision","pytorch","tensorflow","scikit-learn","pandas","numpy","llm",
  "html","css","tailwind","sass","figma","ui/ux","product design","wireframing",
  "selenium","cypress","playwright","jest","junit","qa automation","manual testing",
  "salesforce","sap","oracle","power bi","tableau","excel","looker",
  "project management","scrum","agile","jira","stakeholder management","business analysis",
  "recruitment","talent acquisition","payroll","hrms","onboarding",
  "accounting","taxation","gst","audit","financial modelling",
  "sales","business development","lead generation","digital marketing","seo","sem","content marketing",
];

const ROLE_HEAD_RE =
  /\b(designer|developer|engineer|manager|analyst|architect|consultant|recruiter|accountant|executive|lead|director|specialist|technician|officer|assistant|associate|scientist|administrator|merchandiser|stylist|copywriter|marketer|tester|nurse|teacher|chef|supervisor|coordinator|planner|buyer|operator|artist)\b/i;
const ROLE_STOPWORDS = /\b(resume|curriculum|vitae|profile|summary|objective|contact|email|mobile|phone|address|education|skills?|experience|employment|certification|declaration|languages?)\b/i;

function titleCase(s: string) {
  return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

function nameFromDoc(docText: string, fileName?: string | null, email?: string | null): string | null {
  return extractCvName(docText, fileName ?? null, { email: email ?? null });
}


function nameFromEmail(email: string | null): string | null {
  if (!email) return null;
  const local = email.split("@")[0] ?? "";
  const words = local.split(/[._\-+]/).filter((w) => /^[a-z]{2,20}$/i.test(w));
  return words.length >= 2 ? titleCase(words.slice(0, 3).join(" ")) : null;
}

function cleanRole(raw: string | null | undefined): string | null {
  const role = (raw ?? "")
    .replace(/\b(?:applying|applied)\s+for\b/gi, "")
    .replace(/\b(?:role|position|designation|profile)\b\s*[:\-–]?/gi, "")
    .replace(/[^A-Za-z0-9+#/&. -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!role || role.length < 3 || role.length > 70) return null;
  if (!ROLE_HEAD_RE.test(role) || ROLE_STOPWORDS.test(role)) return null;
  return titleCase(role.toLowerCase());
}

function roleFromText(text: string): string | null {
  const labelled = ROLE_LABEL_RE.exec(text)?.[1];
  const fromLabel = cleanRole(labelled);
  if (fromLabel) return fromLabel;
  return null;
}

function roleFromDoc(docText: string, knownName: string | null): string | null {
  const lines = docText
    .split("\n")
    .slice(0, 24)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const nameNorm = (knownName ?? "").toLowerCase();
  for (const line of lines) {
    const l = line.toLowerCase();
    if (nameNorm && l === nameNorm) continue;
    if (EMAIL_RE.test(line) || PHONE_RE.test(line) || LOCATION_RE.test(line)) continue;
    const role = cleanRole(line);
    if (role) return role;
  }
  return null;
}

export type DeterministicInput = {
  fromEmail: string | null;
  fromName: string | null;
  cleanBody: string;
  docText: string;
  primaryFileName: string | null;
};

export type DeterministicResult = {
  fields: Extracted;
  coverage: FieldCoverage;
  gaps: Facet[];
  /** Compensation / notice, scoped to candidate-owned text (may be null). */
  scoped: { currentCtc: string | null; expectedCtc: string | null; noticePeriod: string | null };
};


/** Pull every field a regex or dictionary can reliably find. No model calls. */
export function extractDeterministic(i: DeterministicInput): DeterministicResult {
  const text = `${i.docText}\n${i.cleanBody}`;
  const lower = text.toLowerCase();
  const hasAttachment = !!i.primaryFileName;

  // Gmail's sender is the SOURCE. Only a self-application may donate identity.
  const senderIsCandidate = senderLooksLikeCandidate({
    fromEmail: i.fromEmail,
    fromName: i.fromName,
    docText: i.docText,
    bodyText: i.cleanBody,
    hasAttachment,
  });

  const sender = (i.fromEmail ?? "").toLowerCase();
  const docEmails = (i.docText.match(EMAIL_GLOBAL_RE) ?? []).map((e) => e.toLowerCase());
  const bodyEmails = (i.cleanBody.match(EMAIL_GLOBAL_RE) ?? []).map((e) => e.toLowerCase());
  const candidateRows = [...extractCandidateRows(i.docText), ...extractCandidateRows(i.cleanBody)];
  const firstRow = findCandidateRow(candidateRows, {
    email: docEmails.find((e) => e !== sender) ?? bodyEmails.find((e) => e !== sender) ?? null,
    phone: i.docText.match(PHONE_GLOBAL_RE)?.[0] ?? i.cleanBody.match(PHONE_GLOBAL_RE)?.[0] ?? null,
    name: nameFromDoc(i.docText, i.primaryFileName) ?? candidateNameFromText(text) ?? candidateNameFromFile(i.primaryFileName),
  });
  const email =
    docEmails.find((e) => e !== sender) ??
    firstRow?.email ??
    (hasAttachment ? null : bodyEmails.find((e) => e !== sender)) ??
    (senderIsCandidate ? sender || null : null) ??
    null;

  const docPhoneRaw = i.docText.match(PHONE_GLOBAL_RE)?.[0] ?? null;
  const bodyPhoneRaw = i.cleanBody.match(PHONE_GLOBAL_RE)?.[0] ?? null;
  const phoneRaw = docPhoneRaw ?? firstRow?.phone ?? (hasAttachment ? null : bodyPhoneRaw ?? text.match(PHONE_RE)?.[0] ?? null);
  const phoneCand = phoneRaw && phoneRaw.replace(/\D/g, "").length >= 10 ? phoneRaw.trim() : null;

  const linkedin = text.match(LINKEDIN_RE)?.[0] ?? null;

  // Resume first, then a labelled name in the mail, then the CV file name. The
  // Gmail display name is only acceptable when the sender IS the candidate.
  const name =
    nameFromDoc(i.docText, i.primaryFileName, email) ??
    candidateNameFromText(text) ??
    firstRow?.name ??
    candidateNameFromFile(i.primaryFileName) ??
    (senderIsCandidate
      ? (i.fromName && !/no.?reply|team|support|hr\b/i.test(i.fromName) ? i.fromName : null) ?? nameFromEmail(email)
      : null);

  // A scanned CV yields no text, so any contact detail here came from the mail
  // body — often the recruiter's tracker listing *other* people. Keep it only
  // when it plainly belongs to this candidate.
  const docHasContact = !!docEmails.length || !!docPhoneRaw;
  const nameWords = (name ?? "").toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
  const emailAgrees =
    !!email && nameWords.some((w) => (email.split("@")[0] ?? "").toLowerCase().includes(w));
  const bodyContactTrusted = docHasContact || emailAgrees || !name;
  const emailOut = bodyContactTrusted ? email : null;
  const phone = bodyContactTrusted ? phoneCand : null;


  // Role / experience / location / company / CTC come from candidate-owned text
  // only. A recruiter mail listing several people must not donate another
  // person's city, years or package to this row.
  const bodyTrusted = candidateRows.length <= 1 && (!hasAttachment || !i.docText.trim());
  const scoped = extractScopedFields({ docText: i.docText, bodyText: i.cleanBody, bodyTrusted });

  const role = firstRow?.role ?? scoped.role.value;
  const experience = scoped.experience.value;
  const company = firstRow?.current_company ?? scoped.company.value;
  const location = firstRow?.location ?? scoped.location.value;

  const ctcNum = (v: string | null) => {
    const n = v ? Number(/(\d{1,3}(?:\.\d{1,2})?)/.exec(v)?.[1] ?? NaN) : NaN;
    return Number.isFinite(n) && n > 0 && n <= 999 ? n : null;
  };
  const salaryMin = ctcNum(scoped.currentCtc.value);
  const salaryMax = ctcNum(scoped.expectedCtc.value);


  const skills = SKILL_DICTIONARY.filter((s) => {
    const idx = lower.indexOf(s);
    if (idx < 0) return false;
    const before = lower[idx - 1] ?? " ";
    const after = lower[idx + s.length] ?? " ";
    return !/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after);
  }).slice(0, 30);

  const fields: Extracted = {
    name: name ?? null,
    email: emailOut,
    phone,
    role: role ?? null,
    current_company: company ? titleCase(company) : null,
    experience: firstRow?.experience ?? experience,
    location: location ? titleCase(location) : null,
    salary_min: Number.isFinite(salaryMin as number) ? salaryMin : null,
    salary_max: Number.isFinite(salaryMax as number) ? salaryMax : null,
    skills,
    notes: linkedin ? `LinkedIn: ${linkedin}` : null,
  };

  const clean = sanitizeCandidateIdentity(
    { name: fields.name, email: fields.email, phone: fields.phone },
    {
      fromEmail: i.fromEmail,
      fromName: i.fromName,
      docText: i.docText,
      bodyText: i.cleanBody,
      hasAttachment: !!i.primaryFileName,
    },
  );
  fields.name = clean.name ?? null;
  fields.email = clean.email ?? null;
  fields.phone = clean.phone ?? null;

  const coverage: FieldCoverage = {
    identity: fields.name ? 100 : 0,
    contact: (fields.email ? 55 : 0) + (fields.phone ? 30 : 0) + (linkedin ? 15 : 0),
    experience: (experience ? 55 : 0) + (company ? 45 : 0),
    skills: Math.min(100, skills.length * 20),
  };

  const gaps = (Object.keys(COVERAGE_TARGETS) as Facet[]).filter((f) => coverage[f] < COVERAGE_TARGETS[f]);

  return {
    fields,
    coverage,
    gaps,
    scoped: {
      currentCtc: scoped.currentCtc.value,
      expectedCtc: scoped.expectedCtc.value,
      noticePeriod: scoped.noticePeriod.value,
    },
  };

}

/** Merge AI-filled gaps on top of deterministic fields; deterministic wins on conflict. */
export function mergeFields(base: Extracted, ai: Partial<Extracted>): Extracted {
  const out: Extracted = { ...base };
  for (const [k, v] of Object.entries(ai) as [keyof Extracted, unknown][]) {
    const current = out[k];
    const currentEmpty = current == null || (Array.isArray(current) && current.length === 0);
    if (!currentEmpty) continue;
    if (v == null || (Array.isArray(v) && v.length === 0)) continue;
    (out as Record<string, unknown>)[k] = v;
  }
  return out;
}