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
  const found = emailsIn(`${doc}\n${body}`);
  if (found.includes(sender)) return true;
  // A CV is present but never mentions the sender → the sender forwarded it.
  if (doc.trim().length > 0 || ctx.hasAttachment) return false;
  // The sender's display name appears in the body signature.
  const name = squash(ctx.fromName);
  if (name && name.split(" ").length >= 2 && squash(body).includes(name)) return true;
  return found.length === 0;
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
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
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
  const body = ctx.bodyText ?? "";
  const haystack = squash(`${doc} ${body}`);
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
  void haystack;
  return out;
}
