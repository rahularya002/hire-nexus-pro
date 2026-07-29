// NORMALIZATION stage — hashing, body cleaning and deterministic (AI-free) field
// extraction. Nothing in this file ever calls a model.
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
const PHONE_RE = /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{3,5}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}\b/;
const LINKEDIN_RE = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[a-z0-9\-_%]{3,}/i;
const YEARS_RE = /(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years?|yrs?)\b[^.\n]{0,30}(?:experience|exp\b)?/i;
const CTC_RE = /(?:ctc|salary|package|compensation)[^\n]{0,40}?(\d{1,3}(?:\.\d{1,2})?)\s*(?:-|to|–)?\s*(\d{1,3}(?:\.\d{1,2})?)?\s*(lpa|lakh|lacs?|l\b)/i;
const COMPANY_RE = /\b(?:currently (?:working )?(?:at|with)|working (?:at|with)|employed (?:at|with)|company\s*[:\-])\s*([A-Z][\w&.,'\- ]{2,40})/;
const LOCATION_RE =
  /\b(bengaluru|bangalore|mumbai|pune|hyderabad|chennai|delhi|new delhi|noida|gurgaon|gurugram|kolkata|ahmedabad|jaipur|indore|chandigarh|kochi|coimbatore|nagpur|lucknow|bhopal|vadodara|surat|thiruvananthapuram|mysuru|mysore|remote|singapore|dubai|london|new york|san francisco|berlin|toronto|sydney)\b/i;

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

const NAME_LINE_RE = /^[A-Z][a-z'’\-]{1,20}(?:\s+[A-Z][a-z'’\-]{1,20}){1,3}$/;
const NAME_STOPWORDS = /\b(resume|curriculum|vitae|profile|confidential|contact|address|objective|summary)\b/i;

function titleCase(s: string) {
  return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

function nameFromFile(fileName: string | null): string | null {
  if (!fileName) return null;
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[_\-.]+/g, " ");
  const cleaned = base.replace(/\b(resume|cv|final|updated|new|copy|latest|v\d+|\d{2,})\b/gi, "").replace(/\s+/g, " ").trim();
  const words = cleaned.split(" ").filter((w) => /^[A-Za-z]{2,20}$/.test(w));
  return words.length >= 2 && words.length <= 4 ? titleCase(words.join(" ")) : null;
}

function nameFromDoc(docText: string): string | null {
  for (const line of docText.split("\n").slice(0, 12)) {
    const t = line.trim().replace(/\s{2,}/g, " ");
    if (!t || t.length > 45 || NAME_STOPWORDS.test(t)) continue;
    if (NAME_LINE_RE.test(t)) return t;
    if (/^[A-Z][A-Z\s'’\-]{4,40}$/.test(t) && t.split(/\s+/).length >= 2) return titleCase(t);
  }
  return null;
}

function nameFromEmail(email: string | null): string | null {
  if (!email) return null;
  const local = email.split("@")[0] ?? "";
  const words = local.split(/[._\-+]/).filter((w) => /^[a-z]{2,20}$/i.test(w));
  return words.length >= 2 ? titleCase(words.slice(0, 3).join(" ")) : null;
}

export type DeterministicInput = {
  fromEmail: string | null;
  fromName: string | null;
  cleanBody: string;
  docText: string;
  primaryFileName: string | null;
};

export type DeterministicResult = { fields: Extracted; coverage: FieldCoverage; gaps: Facet[] };

/** Pull every field a regex or dictionary can reliably find. No model calls. */
export function extractDeterministic(i: DeterministicInput): DeterministicResult {
  const text = `${i.docText}\n${i.cleanBody}`;
  const lower = text.toLowerCase();

  const emailMatch = i.docText.match(EMAIL_RE)?.[0] ?? i.cleanBody.match(EMAIL_RE)?.[0] ?? null;
  const email = (emailMatch ?? i.fromEmail ?? null)?.toLowerCase() ?? null;

  const phoneRaw = text.match(PHONE_RE)?.[0] ?? null;
  const phone = phoneRaw && phoneRaw.replace(/\D/g, "").length >= 10 ? phoneRaw.trim() : null;

  const linkedin = text.match(LINKEDIN_RE)?.[0] ?? null;

  const name =
    nameFromDoc(i.docText) ??
    (i.fromName && !/no.?reply|team|support|hr\b/i.test(i.fromName) ? i.fromName : null) ??
    nameFromFile(i.primaryFileName) ??
    nameFromEmail(email);

  const years = text.match(YEARS_RE)?.[1] ?? null;
  const experience = years ? `${years} years` : null;

  const company = text.match(COMPANY_RE)?.[1]?.trim().replace(/[.,;]$/, "") ?? null;
  const location = text.match(LOCATION_RE)?.[0] ?? null;

  const ctc = text.match(CTC_RE);
  const salaryMin = ctc?.[1] ? Number(ctc[1]) : null;
  const salaryMax = ctc?.[2] ? Number(ctc[2]) : null;

  const skills = SKILL_DICTIONARY.filter((s) => {
    const idx = lower.indexOf(s);
    if (idx < 0) return false;
    const before = lower[idx - 1] ?? " ";
    const after = lower[idx + s.length] ?? " ";
    return !/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after);
  }).slice(0, 30);

  const fields: Extracted = {
    name: name ?? null,
    email,
    phone,
    role: null,
    current_company: company ? titleCase(company) : null,
    experience,
    location: location ? titleCase(location) : null,
    salary_min: Number.isFinite(salaryMin as number) ? salaryMin : null,
    salary_max: Number.isFinite(salaryMax as number) ? salaryMax : null,
    skills,
    notes: linkedin ? `LinkedIn: ${linkedin}` : null,
  };

  const coverage: FieldCoverage = {
    identity: name ? 100 : 0,
    contact: (email ? 55 : 0) + (phone ? 30 : 0) + (linkedin ? 15 : 0),
    experience: (experience ? 55 : 0) + (company ? 45 : 0),
    skills: Math.min(100, skills.length * 20),
  };

  const gaps = (Object.keys(COVERAGE_TARGETS) as Facet[]).filter((f) => coverage[f] < COVERAGE_TARGETS[f]);

  return { fields, coverage, gaps };
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