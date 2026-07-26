// Server-only Gmail API helpers. Imported dynamically from server-function handlers.

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export type GmailLabel = { id: string; name: string; type?: string };

async function gget<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${GMAIL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Gmail API ${path} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export async function listLabels(accessToken: string): Promise<GmailLabel[]> {
  const json = await gget<{ labels?: GmailLabel[] }>(accessToken, "/labels");
  return (json.labels ?? []).filter((l) => l.id !== "CHAT");
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

export function buildQuery(args: {
  dateFrom?: string | null;
  dateTo?: string | null;
  labels?: string[];
  exclusions?: string[];
}) {
  // Attachment-bearing mail OR mail that talks like recruitment. The classifier
  // decides what is actually recruitment — the query only sets the scope.
  const parts: string[] = [
    "{" +
      "(has:attachment (filename:pdf OR filename:doc OR filename:docx))" +
      ' (subject:(resume OR cv OR candidate OR profile OR interview OR hiring OR shortlist OR opening OR position OR applying OR application OR recruitment) OR "notice period" OR "current ctc" OR "expected ctc" OR "years of experience")' +
      "}",
  ];
  if (args.dateFrom) parts.push(`after:${fmtDate(args.dateFrom)}`);
  if (args.dateTo) parts.push(`before:${fmtDate(args.dateTo)}`);
  const labels = (args.labels ?? []).filter(Boolean);
  if (labels.length === 1) parts.push(`label:"${labels[0]}"`);
  else if (labels.length > 1) parts.push(`{${labels.map((l) => `label:"${l}"`).join(" ")}}`);
  for (const ex of args.exclusions ?? []) {
    const v = ex.trim();
    if (!v) continue;
    parts.push(v.includes("@") ? `-from:${v}` : `-from:*@${v.replace(/^@/, "")}`);
  }
  // Default noise exclusions: automated senders and promotional buckets are
  // never candidate resumes, so keep them out before we download anything.
  parts.push(
    "-from:noreply",
    "-from:no-reply",
    "-from:donotreply",
    "-from:do-not-reply",
    "-from:statements",
    "-from:statement",
    "-from:billing",
    "-from:invoice",
    "-from:newsletter",
    "-category:promotions",
    "-category:social",
    "-label:spam",
  );
  return parts.join(" ");
}

export async function listMessageIds(
  accessToken: string,
  query: string,
  pageToken?: string | null,
  maxResults = 25,
) {
  const params = new URLSearchParams({ q: query, maxResults: String(maxResults) });
  if (pageToken) params.set("pageToken", pageToken);
  const json = await gget<{
    messages?: { id: string; threadId: string }[];
    nextPageToken?: string;
    resultSizeEstimate?: number;
  }>(accessToken, `/messages?${params.toString()}`);
  return {
    messages: json.messages ?? [],
    nextPageToken: json.nextPageToken ?? null,
    estimate: json.resultSizeEstimate ?? 0,
  };
}

type Part = {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { attachmentId?: string; size?: number; data?: string };
  parts?: Part[];
};

export type GmailMessage = {
  id: string;
  threadId: string;
  internalDate?: string;
  labelIds?: string[];
  snippet?: string;
  payload?: Part;
};

export async function getMessage(accessToken: string, id: string) {
  return gget<GmailMessage>(accessToken, `/messages/${encodeURIComponent(id)}?format=full`);
}

function decodeB64Url(data: string): string {
  try {
    const b64 = data.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(b64, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

/** Decoded plain-text body of a Gmail message (HTML stripped when needed). */
export function getBodyText(msg: GmailMessage, limit = 6000): string {
  let plain = "";
  let html = "";
  const walk = (p?: Part) => {
    if (!p) return;
    const mime = (p.mimeType ?? "").toLowerCase();
    if (!p.filename && p.body?.data) {
      if (mime === "text/plain") plain += decodeB64Url(p.body.data) + "\n";
      else if (mime === "text/html") html += decodeB64Url(p.body.data) + "\n";
    }
    for (const c of p.parts ?? []) walk(c);
  };
  walk(msg.payload);
  const raw =
    plain.trim() ||
    html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|tr|li|h\d)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">");
  return raw.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, limit);
}

export function header(msg: GmailMessage, name: string): string | null {
  const h = msg.payload?.headers?.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h?.value ?? null;
}

export function parseAddress(raw: string | null) {
  if (!raw) return { name: null as string | null, email: null as string | null };
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || null, email: m[2].trim().toLowerCase() };
  const t = raw.trim().toLowerCase();
  return { name: null, email: t.includes("@") ? t : null };
}

export function parseAddressList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => parseAddress(s).email)
    .filter((x): x is string => !!x);
}

const RESUME_EXT = /\.(pdf|docx|doc|txt)$/i;

export type ResumeAttachment = {
  attachmentId: string;
  filename: string;
  mimeType: string | null;
  size: number;
};

export function findResumeAttachments(msg: GmailMessage): ResumeAttachment[] {
  const out: ResumeAttachment[] = [];
  const walk = (p?: Part) => {
    if (!p) return;
    if (p.filename && RESUME_EXT.test(p.filename) && p.body?.attachmentId) {
      out.push({
        attachmentId: p.body.attachmentId,
        filename: p.filename,
        mimeType: p.mimeType ?? null,
        size: p.body.size ?? 0,
      });
    }
    for (const c of p.parts ?? []) walk(c);
  };
  walk(msg.payload);
  return out;
}

/* ------------------------------------------------------------------ *
 * Noise filtering — keep bank/exchange/billing mail out of the archive
 * ------------------------------------------------------------------ */

const NOISE_FILENAME =
  /(statement|invoice|receipt|bill|txn|transaction|payment|policy|premium|ticket|booking|itinerary|contract[\s_-]?note|holding|passbook|payslip|pay[\s_-]?slip|salary[\s_-]?slip|form[\s_-]?16|gst|tax|order|shipment|nse|bse|cas[\s_-]|portfolio|ledger)/i;

const RESUME_FILENAME =
  /(resume|resum|cv[\s_.\-]|[\s_.\-]cv|curriculum|vitae|naukri|linkedin|profile|candidate|biodata|bio[\s_-]?data)/i;

const NOISE_SENDER_DOMAIN =
  /(nse\.co\.in|bseindia|paytm|phonepe|razorpay|hdfcbank|icicibank|axisbank|sbi\.co|kotak|zerodha|groww|upstox|angelone|cdslindia|nsdl|amazon|flipkart|swiggy|zomato|uber|ola|irctc|makemytrip|netflix|spotify|apple\.com|google\.com|microsoft\.com|facebookmail|instagram|twitter|linkedin\.com|noreply|billdesk|bajaj|policybazaar|lic\.|insurance|creditcard|bank)/i;

const NOISE_SENDER_LOCAL =
  /^(alerts?|noreply|no-reply|donotreply|do-not-reply|notifications?|statements?|updates?|info|support|billing|invoices?|newsletter|mailer|marketing|news|admin|service|care|help|team|hello|contact)([._-].*)?$/i;

const NOISE_SUBJECT =
  /(statement|transaction|invoice|receipt|payment|otp|verify|password|newsletter|webinar|sale|offer|discount|order|delivery|policy|premium|due|reminder|alert|bulletin|circular|market|nav |portfolio|balance)/i;

export function senderLooksAutomated(fromEmail: string | null): boolean {
  if (!fromEmail) return false;
  const [local = "", domain = ""] = fromEmail.toLowerCase().split("@");
  return NOISE_SENDER_LOCAL.test(local) || NOISE_SENDER_DOMAIN.test(domain);
}

export function filenameLooksLikeResume(filename: string): boolean {
  const base = filename.replace(/\.[^.]+$/, "");
  if (NOISE_FILENAME.test(base)) return false;
  if (RESUME_FILENAME.test(base)) return true;
  // "Firstname Lastname" / "firstname_lastname" style attachment names.
  const words = base.replace(/[_\-.]+/g, " ").trim().split(/\s+/).filter(Boolean);
  const nameish = words.length >= 2 && words.length <= 4 && words.every((w) => /^[A-Za-z]{2,20}$/.test(w));
  return nameish;
}

/**
 * Cheap pre-download gate: decide whether a message plausibly carries a
 * candidate resume, using only headers + attachment filenames.
 */
export function messageLooksLikeResumeEmail(args: {
  fromEmail: string | null;
  subject: string | null;
  attachments: ResumeAttachment[];
}): { keep: boolean; reason?: string } {
  const good = args.attachments.filter((a) => filenameLooksLikeResume(a.filename));
  const anyNoise = args.attachments.every((a) => NOISE_FILENAME.test(a.filename));
  if (anyNoise) return { keep: false, reason: "attachment looks like a statement/invoice" };

  const automated = senderLooksAutomated(args.fromEmail);
  if (automated && good.length === 0) return { keep: false, reason: "automated sender, no resume-like attachment" };
  if (automated && NOISE_SUBJECT.test(args.subject ?? "")) {
    return { keep: false, reason: "automated sender with transactional subject" };
  }
  return { keep: true };
}

/** Filter an attachment list down to plausible resumes (keeps all when unsure). */
export function preferResumeAttachments(atts: ResumeAttachment[]): ResumeAttachment[] {
  const clean = atts.filter((a) => !NOISE_FILENAME.test(a.filename));
  const strong = clean.filter((a) => filenameLooksLikeResume(a.filename));
  return strong.length > 0 ? strong : clean;
}

const RESUME_SECTIONS = [
  /\bexperience\b/i,
  /\beducation\b/i,
  /\bskills?\b/i,
  /\bprojects?\b/i,
  /\bcertificat/i,
  /\bobjective\b/i,
  /\bwork history\b/i,
  /\bemployment\b/i,
  /\bqualification/i,
  /\bcareer\b/i,
];

/** Content-level gate: does the extracted text read like a CV? */
export function textLooksLikeResume(text: string): boolean {
  const t = (text ?? "").trim();
  if (t.length < 400) return false;
  const hits = RESUME_SECTIONS.filter((re) => re.test(t)).length;
  return hits >= 2;
}

export async function getAttachmentBytes(
  accessToken: string,
  messageId: string,
  attachmentId: string,
): Promise<Uint8Array> {
  const json = await gget<{ data?: string; size?: number }>(
    accessToken,
    `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
  );
  const b64 = (json.data ?? "").replace(/-/g, "+").replace(/_/g, "/");
  return new Uint8Array(Buffer.from(b64, "base64"));
}