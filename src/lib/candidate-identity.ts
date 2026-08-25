// Candidate identity guard.
//
// A recruitment email is very often a FORWARD: the Gmail sender is the recruiter,
// the candidate lives inside the attached CV (or in the body). Letting the Gmail
// display name / sender address become the candidate's identity produces the
// worst possible failure: dozens of different people shown (and deduplicated) as
// "Itisha Bindal". Sender details are provenance only.
//
// This module is pure and client-safe so the rule can be unit tested and reused
// by the extraction pipeline, the importer and the grid adapters.

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export type IdentityContext = {
  fromEmail: string | null | undefined;
  fromName: string | null | undefined;
  /** Text extracted from the attached CV, if any. */
  docText?: string | null;
  /** Cleaned email body. */
  bodyText?: string | null;
  hasAttachment?: boolean;
};

const lower = (s: string | null | undefined) => (s ?? "").toLowerCase();
const squash = (s: string | null | undefined) =>
  lower(s).replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim();
const digitsOf = (s: string | null | undefined) => (s ?? "").replace(/\D+/g, "");

function emailsIn(text: string): string[] {
  return (text.match(EMAIL_RE) ?? []).map((e) => e.toLowerCase());
}

/**
 * True when the sender is plausibly the candidate themselves: their address is
 * repeated inside the CV / body (a self-application), or the mail carries no
 * other identity at all and no attachment (a plain "here are my details" note).
 */
export function senderLooksLikeCandidate(ctx: IdentityContext): boolean {
  const sender = lower(ctx.fromEmail);
  if (!sender) return false;
  const doc = ctx.docText ?? "";
  const body = ctx.bodyText ?? "";
  // With a CV attached, recruiter signatures in the email body frequently repeat
  // the sender address. That must not make the sender the candidate. Only the CV
  // text itself can prove sender == candidate in an attachment-backed mail.
  const docEmails = emailsIn(doc);
  if (docEmails.includes(sender)) return true;
  if (doc.trim().length > 0 || ctx.hasAttachment) return false;
  const bodyEmails = emailsIn(body);
  if (bodyEmails.includes(sender)) return true;
  // The sender's display name appears in the body signature.
  const name = squash(ctx.fromName);
  if (name && name.split(" ").length >= 2 && squash(body).includes(name)) return true;
  return false;
}

/** Sender display name, or a name derived from their address — never a candidate. */
export function senderNameForms(ctx: IdentityContext): string[] {
  const out: string[] = [];
  const dn = squash(ctx.fromName);
  if (dn) out.push(dn);
  const local = lower(ctx.fromEmail).split("@")[0] ?? "";
  const parts = local.split(/[._\-+0-9]+/).filter((w) => w.length >= 2);
  if (parts.length >= 2) out.push(parts.join(" "));
  return out;
}

const NAME_LABEL_RE =
  /\b(?:candidate(?:'s)?\s*name|full\s*name|name\s*of\s*(?:the\s*)?candidate|name)\s*[:\-–]\s*([A-Za-z][A-Za-z.'’\- ]{2,40})/i;

/**
 * Name explicitly labelled in a resume or a recruiter's submission mail, e.g.
 * "Candidate Name: Prem Lata Chauhan".
 */
export function candidateNameFromText(text: string | null | undefined): string | null {
  const m = NAME_LABEL_RE.exec(text ?? "");
  const raw = m?.[1]?.replace(/\s+/g, " ").trim();
  if (!raw) return null;
  const words = raw.split(" ").filter((w) => /^[A-Za-z][A-Za-z.'’-]*$/.test(w));
  if (words.length < 2 || words.length > 4) return null;
  return words
    .map((w) => {
      const first = w[0];
      return first ? first.toUpperCase() + w.slice(1) : w;
    })
    .join(" ");
}

const FILE_STOPWORDS = new Set([
  "resume", "resum", "cv", "curriculum", "vitae", "profile", "candidate", "final", "updated", "latest",
  "copy", "new", "naukri", "linkedin", "biodata", "bio", "data",
]);

const FILE_ROLE_WORDS = new Set([
  "fashion", "apparel", "garment", "garments", "clothing", "womenswear", "menswear", "designer", "design",
  "stylist", "merchandiser", "manager", "developer", "engineer", "analyst", "consultant", "executive",
  "associate", "artist", "makeup", "sales", "marketing", "sourcing", "category", "retail", "planner", "head",
]);

function titleWord(w: string) {
  const first = w[0];
  if (!first) return w;
  return w.length <= 3 && w === w.toUpperCase() ? w : first.toUpperCase() + w.slice(1).toLowerCase();
}

/** Candidate-looking name from a CV filename, never from the Gmail sender. */
export function candidateNameFromFile(fileName: string | null | undefined): string | null {
  if (!fileName) return null;
  const base = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_\-.()[\]{}]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const picked: string[] = [];
  for (const raw of base.split(" ")) {
    const word = raw.replace(/[^A-Za-z]/g, "");
    if (!word || /\d/.test(raw)) continue;
    const key = word.toLowerCase();
    if (FILE_STOPWORDS.has(key)) continue;
    if (FILE_ROLE_WORDS.has(key) && picked.length >= 2) break;
    if (FILE_ROLE_WORDS.has(key) && picked.length < 2) continue;
    if (!/^[A-Za-z]{2,20}$/.test(word)) continue;
    picked.push(word);
    if (picked.length === 4) break;
  }
  return picked.length >= 2 ? picked.map(titleWord).join(" ") : null;
}

export type IdentityFields = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

/**
 * Strip sender-derived identity from extracted candidate fields. Runs last, so
 * it also catches values a model invented from the "From:" header.
 */
export function sanitizeCandidateIdentity<T extends IdentityFields>(fields: T, ctx: IdentityContext): T {
  if (senderLooksLikeCandidate(ctx)) return fields;

  const doc = ctx.docText ?? "";
  const out = { ...fields };

  const name = squash(out.name);
  if (name && senderNameForms(ctx).some((s) => s === name || s.includes(name) || name.includes(s))) {
    // Accept it only when the CV itself states that name (sender == candidate,
    // e.g. a recruiter who is also the applicant).
    const inDoc = squash(doc).includes(name);
    if (!inDoc) out.name = null;
  }

  if (out.email && lower(out.email) === lower(ctx.fromEmail)) out.email = null;

  // The signature phone of a forwarding recruiter must not become the
  // candidate's phone — that would merge every candidate they ever sent.
  const phone = digitsOf(out.phone);
  if (phone.length >= 8 && doc.trim().length > 0) {
    const inDoc = digitsOf(doc).includes(phone);
    if (!inDoc) out.phone = null;
  }
  return out;
}
