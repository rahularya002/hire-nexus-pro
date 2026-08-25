// Pure helpers for the Gmail-derived Candidate Grid: compensation / notice-period
// extraction from email + resume text, and identity-based row merging.
// Nothing is invented here — a field is only set when the text actually states it.

export type GridSource = {
  messageId: string;
  threadId: string;
  subject: string | null;
  fromName: string | null;
  fromEmail: string | null;
  sentAt: string | null;
  attachmentNames: string[];
  hasResume: boolean;
};

export type GridCandidate = {
  /** Stable key for the merged row (identity based, falls back to the message). */
  key: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  company: string | null;
  experience: string | null;
  location: string | null;
  skills: string[];
  currentCtc: string | null;
  expectedCtc: string | null;
  noticePeriod: string | null;
  confidence: number;
  unread: boolean;
  sources: GridSource[];
};

const NUM = String.raw`(?:₹|rs\.?|inr)?\s*\d{1,3}(?:[.,]\d{1,2})?\s*(?:lpa|lakhs?|lacs?|l|k|cr|crore|per annum|pa|p\.a\.?)?`;

function tidy(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.replace(/\s+/g, " ").replace(/^[:\-–\s]+/, "").replace(/[.,;]+$/, "").trim();
  return s.length ? s.slice(0, 60) : null;
}

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = re.exec(text);
    if (m?.[1]) {
      const v = tidy(m[1]);
      if (v && /\d/.test(v)) return v;
    }
  }
  return null;
}

/** Current CTC / current salary, as literally stated in the text. */
export function extractCurrentCtc(text: string): string | null {
  return firstMatch(text, [
    new RegExp(String.raw`\bcurrent\s*(?:ctc|salary|compensation|package)\b[^\dA-Za-z₹]{0,10}(${NUM})`, "i"),
    new RegExp(String.raw`\b(?:ctc|salary)\s*\(?\s*current\s*\)?\s*[:\-]?\s*(${NUM})`, "i"),
    new RegExp(String.raw`\bpresent\s*(?:ctc|salary)\b[^\dA-Za-z₹]{0,10}(${NUM})`, "i"),
    new RegExp(String.raw`\bctc\b\s*[:\-]\s*(${NUM})`, "i"),
  ]);
}

/** Expected / desired CTC. */
export function extractExpectedCtc(text: string): string | null {
  return firstMatch(text, [
    new RegExp(String.raw`\b(?:expected|expectation|desired|exp\.?)\s*(?:ctc|salary|compensation|package)\b[^\dA-Za-z₹]{0,10}(${NUM})`, "i"),
    new RegExp(String.raw`\b(?:ctc|salary)\s*expectation[s]?\b[^\dA-Za-z₹]{0,10}(${NUM})`, "i"),
  ]);
}

/** Notice period, e.g. "60 days", "2 months", "Immediate". */
export function extractNoticePeriod(text: string): string | null {
  const re = /\bnotice\s*period\b\s*(?:is|:|-|–)?\s*([^\n,;.|]{0,32})/i;
  const m = re.exec(text);
  if (m?.[1]) {
    const v = tidy(m[1]);
    if (v && (/\d/.test(v) || /immediate|serving|negotiab|none|nil/i.test(v))) return v;
  }
  if (/\bimmediate(?:ly)?\s*(?:joine[re]|available|joining)\b/i.test(text)) return "Immediate";
  return null;
}

const digits = (s: string | null | undefined) => (s ?? "").replace(/\D+/g, "");
const lower = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/**
 * Identity of a candidate row. Deliberately never the Gmail sender: one recruiter
 * forwards many different people, so collapsing on the sender would merge them.
 */
export function candidateKey(c: {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  role?: string | null;
  messageId: string;
}): string {
  const email = lower(c.email);
  if (email) return `email:${email}`;
  const phone = digits(c.phone);
  if (phone.length >= 8) return `phone:${phone.slice(-10)}`;
  const name = lower(c.name).replace(/\s+/g, " ");
  if (name) return `name:${name}|${lower(c.role)}`;
  return `msg:${c.messageId}`;
}

function pick<T>(a: T | null | undefined, b: T | null | undefined): T | null {
  return (a ?? null) !== null && a !== ("" as unknown as T) ? (a as T) : ((b ?? null) as T | null);
}

/**
 * Merge two rows for the same person: keep the most complete value per field and
 * accumulate every source email. Never overwrites a known value with a blank.
 */
export function mergeCandidates(a: GridCandidate, b: GridCandidate): GridCandidate {
  const better = b.confidence > a.confidence ? b : a;
  const other = better === a ? b : a;
  const sources = [...a.sources];
  for (const s of b.sources) if (!sources.some((x) => x.messageId === s.messageId)) sources.push(s);
  sources.sort((x, y) => (y.sentAt ?? "").localeCompare(x.sentAt ?? ""));
  return {
    key: a.key,
    name: pick(better.name, other.name),
    email: pick(better.email, other.email),
    phone: pick(better.phone, other.phone),
    role: pick(better.role, other.role),
    company: pick(better.company, other.company),
    experience: pick(better.experience, other.experience),
    location: pick(better.location, other.location),
    skills: better.skills.length ? better.skills : other.skills,
    currentCtc: pick(better.currentCtc, other.currentCtc),
    expectedCtc: pick(better.expectedCtc, other.expectedCtc),
    noticePeriod: pick(better.noticePeriod, other.noticePeriod),
    confidence: Math.max(a.confidence, b.confidence),
    unread: a.unread || b.unread,
    sources,
  };
}

/** Collapse a hydrated page into one row per person, newest source first. */
export function mergeCandidateRows(rows: GridCandidate[]): GridCandidate[] {
  const byKey = new Map<string, GridCandidate>();
  const order: string[] = [];
  for (const row of rows) {
    const prev = byKey.get(row.key);
    if (!prev) {
      byKey.set(row.key, row);
      order.push(row.key);
    } else {
      byKey.set(row.key, mergeCandidates(prev, row));
    }
  }
  return order.map((k) => byKey.get(k)!);
}

/** Client-side text filter across every visible column. */
export function matchesGridQuery(c: GridCandidate, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    c.name,
    c.email,
    c.phone,
    c.role,
    c.company,
    c.experience,
    c.location,
    c.currentCtc,
    c.expectedCtc,
    c.noticePeriod,
    ...c.skills,
    ...c.sources.map((s) => s.subject ?? ""),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((t) => hay.includes(t));
}

/**
 * A grid row that may carry natural-language match metadata. The grid stays the
 * single surface: search results are the same rows, with a score column.
 */
export type GridRow = GridCandidate & {
  score?: number | null;
  hitId?: string | null;
  savedAt?: string | null;
};

type HitLike = {
  id: string;
  score: number;
  confidence?: number | null;
  subject: string | null;
  from_name: string | null;
  from_email: string | null;
  sent_at: string | null;
  gmail_message_id: string;
  gmail_thread_id: string | null;
  resume_file_name: string | null;
  saved_at?: string | null;
  extracted: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    role?: string | null;
    location?: string | null;
    experience?: string | null;
    current_company?: string | null;
    skills?: string[] | null;
  } | null;
};

/** Map one search hit onto the same shape the Gmail grid already renders. */
export function hitToGridRow(h: HitLike): GridRow {
  const ex = h.extracted ?? {};
  const text = `${h.subject ?? ""}\n${h.snippetText ?? ""}`;
  return {
    key: candidateKey({ ...ex, messageId: h.gmail_message_id }),
    name: ex.name ?? null,
    email: ex.email ?? null,
    phone: ex.phone ?? null,
    role: ex.role ?? null,
    company: ex.current_company ?? null,
    experience: ex.experience ?? null,
    location: ex.location ?? null,
    skills: ex.skills ?? [],
    currentCtc: extractCurrentCtc(text),
    expectedCtc: extractExpectedCtc(text),
    noticePeriod: extractNoticePeriod(text),
    confidence: h.confidence ?? h.score,
    unread: false,
    sources: [
      {
        messageId: h.gmail_message_id,
        threadId: h.gmail_thread_id ?? h.gmail_message_id,
        subject: h.subject,
        fromName: h.from_name,
        fromEmail: h.from_email,
        sentAt: h.sent_at,
        attachmentNames: h.resume_file_name ? [h.resume_file_name] : [],
        hasResume: !!h.resume_file_name,
      },
    ],
    score: h.score,
    hitId: h.id,
    savedAt: h.saved_at ?? null,
  };
}

/**
 * Collapse hits into grid rows, highest score first. Identity comes from the
 * candidate (email → phone → name+role), never from the forwarding sender, so
 * two people sent by the same recruiter stay two rows.
 */
export function hitsToGridRows(hits: HitLike[]): GridRow[] {
  const rows = hits.map(hitToGridRow);
  const byKey = new Map<string, GridRow>();
  for (const row of rows) {
    const prev = byKey.get(row.key);
    if (!prev) {
      byKey.set(row.key, row);
      continue;
    }
    const merged = mergeCandidates(prev, row) as GridRow;
    const best = (row.score ?? 0) > (prev.score ?? 0) ? row : prev;
    merged.score = Math.max(prev.score ?? 0, row.score ?? 0);
    merged.hitId = best.hitId;
    merged.savedAt = prev.savedAt ?? row.savedAt ?? null;
    byKey.set(row.key, merged);
  }
  return [...byKey.values()].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}
