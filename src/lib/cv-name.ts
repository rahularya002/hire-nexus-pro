// Deterministic candidate-name extraction from resume text.
//
// The previous extractor only accepted a line that was *entirely* a strict
// Title Case or ALL CAPS name inside the first 12 lines. Real PDF text breaks
// that constantly: the header often carries the name plus contact details on
// one line, PDF extraction inserts odd whitespace or glyph spacing, the name
// may be mixed case, and cover pages push the name past line 12. Those cases
// produced "Name not found" — or worse, took a role line ("FASHION DESIGNER")
// as the name.
//
// This module is pure and client-safe so it can be unit tested. It never looks
// at Gmail sender data: the recruiter must never become the candidate.

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{3,5}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}\b/;

const HEADING_RE =
  /\b(resume|résumé|resum|curriculum|vitae|c\.?v\.?|biodata|bio[\s_-]?data|profile|confidential|contact|contacts|address|objective|summary|career|declaration|references?|personal|details|education|qualification|skills?|experience|employment|projects?|certifications?|languages?|hobbies|interests|nationality|gender|marital|date\s*of\s*birth|dob|portfolio|linkedin|email|e-?mail|mobile|phone|tel|permanent|present)\b/i;

const ROLE_WORD_RE =
  /\b(designer|design|developer|engineer|engineering|manager|management|analyst|architect|consultant|recruiter|accountant|executive|lead|director|specialist|technician|officer|assistant|associate|scientist|administrator|merchandiser|merchandising|stylist|styling|copywriter|marketer|marketing|tester|nurse|teacher|chef|supervisor|coordinator|planner|buyer|operator|artist|intern|internship|trainee|freelance|freelancer|sales|hr|human|resources|fashion|apparel|garment|textile|graphic|product|software|senior|junior|sr|jr|head)\b/i;

const PLACE_RE =
  /\b(india|bengaluru|bangalore|mumbai|bombay|pune|hyderabad|chennai|delhi|new\s*delhi|noida|gurgaon|gurugram|kolkata|ahmedabad|jaipur|indore|chandigarh|kochi|coimbatore|nagpur|lucknow|bhopal|vadodara|surat|thiruvananthapuram|mysuru|mysore|remote|singapore|dubai|uae|london|new\s*york|san\s*francisco|berlin|toronto|sydney)\b/i;

const HONORIFIC_RE = /^(mr|mrs|ms|miss|dr|prof|shri|smt)\b\.?\s+/i;

const WORD_RE = /^[A-Za-z][A-Za-z'’-]{0,23}\.?$/;

const NAME_STOPWORD_SET = new Set([
  "the", "and", "of", "for", "with", "to", "in", "at", "a", "an", "na", "n/a", "none", "unknown",
]);

function titleWord(w: string) {
  const first = w[0];
  if (!first) return w;
  return first.toUpperCase() + w.slice(1).toLowerCase();
}

function titleCaseName(s: string) {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map(titleWord)
    .join(" ");
}

/** Rejoin PDF glyph spacing: "P R E M  L A T A" → "PREM LATA". */
function unspaceGlyphs(line: string): string {
  const tokens = line.trim().split(/\s+/);
  if (tokens.length < 4) return line;
  const singles = tokens.filter((t) => t.replace(/[^A-Za-z]/g, "").length === 1).length;
  if (singles / tokens.length < 0.7) return line;
  // Two or more spaces separate words; single spaces separate letters.
  return line
    .trim()
    .split(/\s{2,}/)
    .map((chunk) => chunk.replace(/\s+/g, ""))
    .join(" ");
}

export function normalizeCvLines(text: string | null | undefined): string[] {
  return (text ?? "")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((l) => unspaceGlyphs(l).replace(/\t+|[ ]{2,}/g, " \u2502 ").replace(/ +/g, " ").trim())
    .filter(Boolean);
}

/** Split a header line into candidate segments: "NAME | +91 ... | mail" etc. */
function segments(line: string): string[] {
  return line
    .split(/\s*(?:\||\u2502|•|·|,|;|\u2013|\u2014|\/|\s-\s|\s{2,})\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Does this text read like a person's name? Returns the cleaned name or null. */
export function personNameFrom(raw: string): string | null {
  let s = raw.replace(/[.,;:]+$/, "").trim();
  if (!s || /\d/.test(s)) return null;
  s = s.replace(HONORIFIC_RE, "").trim();
  if (s.length < 4 || s.length > 45) return null;
  if (HEADING_RE.test(s) || ROLE_WORD_RE.test(s) || PLACE_RE.test(s) || EMAIL_RE.test(s)) return null;
  const words = s.split(/\s+/);
  if (words.length < 2 || words.length > 4) return null;
  for (const w of words) {
    if (!WORD_RE.test(w)) return null;
    if (NAME_STOPWORD_SET.has(w.toLowerCase())) return null;
    const letters = w.replace(/[^A-Za-z]/g, "");
    if (letters.length < 1) return null;
    // A one-letter word is only acceptable as an initial ("Prem L. Chauhan").
    if (letters.length === 1 && !w.endsWith(".")) return null;
  }
  const meaningful = words.filter((w) => w.replace(/[^A-Za-z]/g, "").length >= 2);
  if (meaningful.length < 2) return null;
  return titleCaseName(s.replace(/\s+/g, " "));
}

const FILE_STOPWORDS = new Set([
  "resume", "resum", "cv", "curriculum", "vitae", "profile", "candidate", "final", "updated", "latest",
  "copy", "new", "naukri", "linkedin", "biodata", "bio", "data", "doc", "docx", "pdf",
]);

/** Name-looking words from a CV filename — never from the Gmail sender. */
export function nameFromFileName(fileName: string | null | undefined): string | null {
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
    if (FILE_STOPWORDS.has(word.toLowerCase())) continue;
    if (ROLE_WORD_RE.test(word)) {
      if (picked.length >= 2) break;
      continue;
    }
    if (!/^[A-Za-z]{2,20}$/.test(word)) continue;
    picked.push(word);
    if (picked.length === 4) break;
  }
  return picked.length >= 2 ? titleCaseName(picked.join(" ")) : null;
}

const NAME_LABEL_RE =
  /\b(?:candidate(?:'s)?\s*name|full\s*name|name\s*of\s*(?:the\s*)?candidate|name)\s*[:\-–]\s*([A-Za-z][A-Za-z.'’\- ]{2,45})/i;

function nameFromLabel(text: string | null | undefined): string | null {
  const m = NAME_LABEL_RE.exec(text ?? "");
  return m?.[1] ? personNameFrom(m[1]) : null;
}

type Cand = { name: string; score: number; order: number };

/**
 * Extract the candidate's name from resume text, with the CV filename as a
 * secondary source. Returns null when nothing name-like exists, so callers can
 * keep "unknown" rather than inventing an identity.
 */
export function extractCvName(
  docText: string | null | undefined,
  fileName?: string | null,
  hints?: { email?: string | null },
): string | null {
  const lines = normalizeCvLines(docText);
  const labelled = nameFromLabel(lines.join("\n"));
  if (labelled) return labelled;

  const emailLocal = (hints?.email ?? "").split("@")[0]?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
  const fileWords = new Set(
    (nameFromFileName(fileName) ?? "").toLowerCase().split(" ").filter(Boolean),
  );

  const found: Cand[] = [];
  const window = lines.slice(0, 40);
  window.forEach((line, idx) => {
    const parts = [line, ...segments(line)];
    const seen = new Set<string>();
    for (const part of parts) {
      const name = personNameFrom(part);
      if (!name || seen.has(name)) continue;
      seen.add(name);
      let score = 100 - idx * 3;
      // Contact details next to (or on) the line are strong evidence.
      const near = window.slice(Math.max(0, idx - 1), idx + 4).join(" ");
      if (EMAIL_RE.test(near) || PHONE_RE.test(near)) score += 25;
      const words = name.toLowerCase().split(" ");
      if (words.some((w) => fileWords.has(w))) score += 40;
      if (emailLocal && words.some((w) => w.length >= 3 && emailLocal.includes(w))) score += 35;
      if (part === line) score += 5;
      found.push({ name, score, order: idx });
    }
  });

  if (found.length) {
    found.sort((a, b) => b.score - a.score || a.order - b.order);
    const best = found[0];
    if (best) return best.name;
  }
  return nameFromFileName(fileName);
}
