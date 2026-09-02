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
  /\b(resume|résumé|resum|curriculum|vitae|c\.?v\.?|biodata|bio[\s_-]?data|profile|confidential|contact|contacts|address|objective|summary|career|declaration|references?|personal|details|education|qualification|skills?|experience|employment|projects?|certifications?|languages?|hobbies|interests|nationality|gender|marital|date\s*of\s*birth|dob|portfolio|linkedin|email|e-?mail|mobile|phone|tel|permanent|present|about|myself|strengths?|achievements?|awards?|activities|training|internships?|college|university|institute|institution|school|academy|academic|company|pvt|ltd|limited|inc|corp|technologies|solutions|services)\b/i;


const ROLE_WORD_RE =
  /\b(designer|design|developer|engineer|engineering|manager|management|analyst|architect|consultant|recruiter|accountant|executive|lead|director|specialist|technician|officer|assistant|associate|scientist|administrator|merchandiser|merchandising|stylist|styling|copywriter|marketer|marketing|tester|nurse|teacher|chef|supervisor|coordinator|planner|buyer|operator|artist|intern|internship|trainee|freelance|freelancer|sales|hr|human|resources|fashion|apparel|garment|textile|graphic|product|software|senior|junior|sr|jr|head)\b/i;

const PLACE_RE =
  /\b(india|bengaluru|bangalore|mumbai|bombay|pune|hyderabad|chennai|delhi|new\s*delhi|noida|gurgaon|gurugram|kolkata|ahmedabad|jaipur|indore|chandigarh|kochi|coimbatore|nagpur|lucknow|bhopal|vadodara|surat|thiruvananthapuram|mysuru|mysore|remote|singapore|dubai|uae|london|new\s*york|san\s*francisco|berlin|toronto|sydney)\b/i;

const HONORIFIC_RE = /^(mr|mrs|ms|miss|dr|prof|shri|smt)\b\.?\s+/i;

const WORD_RE = /^[A-Za-z][A-Za-z'’-]{0,23}\.?$/;

const NAME_STOPWORD_SET = new Set([
  "the", "and", "of", "for", "with", "to", "in", "at", "a", "an", "na", "n/a", "none", "unknown",
]);

/**
 * Words that can never be part of a person's name. Legacy rows contain values
 * like "Arjitvideocon Gmail Dotcom", "Venkatesh Siddavatam Years Bosh" and
 * "Tilak Raj Managr" — text stitched out of e-mail addresses, resume prose and
 * abbreviations. Any of these words disqualifies the whole phrase.
 */
const NAME_NOISE_RE =
  /\b(gmail|googlemail|yahoo|hotmail|outlook|rediff|rediffmail|icloud|dotcom|dot|com|co|in|net|org|mail|email|inbox|www|http|https|years?|yrs?|yr|month|months|exp|ctc|lpa|lakh|lacs?|salary|package|notice|period|immediate|immediately|joining|joiner|available|availability|dear|sir|madam|hi|hello|thanks|thank|regards|regard|best|kindly|please|find|attached|attachment|herewith|enclosed|below|above|forwarded|fwd|re|subject|team|hr|recruiter|recruitment|talent|acquisition|consultant|consultancy|solutions|services|technologies|pvt|ltd|limited|inc|corp|group|india|noreply|no|reply|support|info|admin|test|sample|unknown|not|found|null|undefined)\b/i;

/** Reject stitched pseudo-names while accepting ordinary human names. */
export function isPlausibleCandidateName(value: string | null | undefined): boolean {
  return !!personNameFrom((value ?? "").trim());
}


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

/**
 * Letter-spaced headers whose word gaps were normalised away collapse into one
 * long token ("S A N T A N U  P A T R A" → "SANTANUPATRA"). Split it back into
 * words using the filename / e-mail tokens that belong to the same candidate.
 */
function splitCollapsedName(collapsed: string, hints: string[]): string | null {
  const letters = collapsed.replace(/[^A-Za-z]/g, "");
  if (letters.length < 7 || letters.length > 40) return null;
  const lower = letters.toLowerCase();
  for (const hint of [...hints].sort((a, b) => b.length - a.length)) {
    if (hint.length < 3) continue;
    if (lower.startsWith(hint) && lower.length - hint.length >= 2) {
      return titleCaseName(`${letters.slice(0, hint.length)} ${letters.slice(hint.length)}`);
    }
    if (lower.endsWith(hint) && lower.length - hint.length >= 2) {
      const cut = lower.length - hint.length;
      return titleCaseName(`${letters.slice(0, cut)} ${letters.slice(cut)}`);
    }
  }
  return null;
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
  if (NAME_NOISE_RE.test(s)) return null;

  const words = s.split(/\s+/);
  if (words.length < 2 || words.length > 4) return null;
  for (const [i, w] of words.entries()) {
    if (!WORD_RE.test(w)) return null;
    const letters = w.replace(/[^A-Za-z]/g, "");
    // "A" is a stopword as a word but valid as an initial ("Kavya A").
    if (letters.length > 1 && NAME_STOPWORD_SET.has(w.toLowerCase())) return null;
    if (letters.length < 1) return null;
    // A bare one-letter word is an initial ("Kavya A", "D Harshitha Reddy") —
    // acceptable anywhere except as the sole word carrying the name.
    if (letters.length === 1 && !w.endsWith(".") && i === 0 && words.length < 2) return null;
  }
  // Sentence case ("Customer satisfaction focus") is prose. Real header names
  // are Title Case, ALL CAPS or fully lower case — never mixed like that.
  const cased = words.filter((w) => /[A-Za-z]{2,}/.test(w));
  const caps = cased.filter((w) => /^[A-Z]/.test(w)).length;
  if (caps > 0 && caps < cased.length) return null;
  const meaningful = words.filter((w) => w.replace(/[^A-Za-z]/g, "").length >= 2);
  if (!meaningful.length) return null;
  // One real word plus an initial is a valid name; two bare words are required
  // otherwise so ordinary prose pairs do not qualify.
  const initials = words.length - meaningful.length;
  if (meaningful.length < 2 && !(initials >= 1 && (meaningful[0]?.length ?? 0) >= 3)) return null;
  return titleCaseName(s.replace(/\s+/g, " "));

}

const FILE_STOPWORDS = new Set([
  "resume", "resum", "cv", "curriculum", "vitae", "profile", "candidate", "final", "updated", "latest",
  "copy", "new", "naukri", "linkedin", "biodata", "bio", "data", "doc", "docx", "pdf",
]);

/** Name-looking words from a CV filename — never from the Gmail sender. */
const FILE_NOISE_RE =
  /\b(job|jd|description|requirement|requirements|mandate|spec|specification|opening|vacancy|logo|invoice|offer|policy|pic|pics|photo|photos|image|img|scan|scanned|pan|aadhar|aadhaar|passport|marksheet|payslip|salary|slip)\b/i;

export function nameFromFileName(fileName: string | null | undefined): string | null {
  if (!fileName) return null;
  if (FILE_NOISE_RE.test(fileName.replace(/[_\-.]+/g, " "))) return null;
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
  if (picked.length >= 2) return titleCaseName(picked.join(" "));
  // A single distinctive word ("Roshni CV.pdf") is still the candidate's own
  // name — far better than borrowing a name from the recruiter's mail body.
  const solo = picked[0];
  const resumeish = /\b(cv|resume|resum|résumé|biodata|profile)\b/i.test(fileName.replace(/[_\-.]+/g, " "));
  if (resumeish && solo && solo.length >= 3 && !HEADING_RE.test(solo) && !PLACE_RE.test(solo)) {
    return titleCaseName(solo);
  }
  return null;
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
  // Tokens that plausibly belong to the candidate, used to split letter-spaced
  // headers. Sender data is never part of this — only the CV file and the
  // candidate's own e-mail address.
  const splitHints = [
    ...fileWords,
    ...(fileName ?? "")
      .replace(/\.[^.]+$/, "")
      .split(/[^A-Za-z]+/)
      .map((w) => w.toLowerCase())
      .filter((w) => w.length >= 3 && !FILE_STOPWORDS.has(w)),
    ...((hints?.email ?? "").split("@")[0] ?? "")
      .split(/[^A-Za-z]+/)
      .map((w) => w.toLowerCase())
      .filter((w) => w.length >= 3),
  ];


  const found: Cand[] = [];
  const window = lines.slice(0, 40);
  window.forEach((line, idx) => {
    const flat = line.replace(/\u2502/g, " ").replace(/\s+/g, " ").trim();
    // Some PDFs extract as one giant blob with no line breaks. Only the very
    // start of such a blob can plausibly be the header name; scanning the whole
    // paragraph invents names out of ordinary prose ("Resolving Issues").
    const head = flat.length > 200 ? flat.slice(0, 60).replace(/\s+\S*$/, "") : flat;
    const headWords = head.split(" ");
    const parts =
      flat.length > 200
        ? [head, ...segments(head), headWords.slice(0, 2).join(" "), headWords.slice(0, 3).join(" ")]
        : [flat, line, ...segments(line)];
    // Columned PDFs put each name word on its own line ("D" / "HARSHITHA" /
    // "REDDY"); stitch short single-word neighbours back together.
    const isWordLine = (l?: string) => !!l && /^[A-Za-z][A-Za-z'’.-]{0,20}$/.test(l.trim());
    if (isWordLine(flat)) {
      const run = [flat];
      for (let j = idx + 1; j < Math.min(window.length, idx + 3); j++) {
        const nxt = window[j]?.trim();
        if (!isWordLine(nxt)) break;
        run.push(nxt!);
      }
      if (run.length >= 2) parts.push(run.join(" "), run.slice(-2).join(" "));
    }
    // "SANTANUPATRA" — a letter-spaced header collapsed into one token.
    if (/^[A-Za-z]{7,40}$/.test(flat)) {
      const split = splitCollapsedName(flat, splitHints);
      if (split) parts.push(split);
    }
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
      if (part === flat) score += 5;
      const supported =
        words.some((w) => fileWords.has(w)) ||
        (!!emailLocal && words.some((w) => w.length >= 3 && emailLocal.includes(w)));
      // Past the header block, only filename/e-mail agreement makes a phrase
      // trustworthy — resume prose is full of innocent two-word phrases.
      const contactNear = EMAIL_RE.test(near) || PHONE_RE.test(near);
      // Past the header block, an unsupported phrase is usually resume prose.
      // Keep it as a last-resort candidate (heavy penalty) only when the whole
      // line is the name and it is still near the top of the document.
      if (idx >= 6 && !supported && !contactNear) {
        if (part !== flat || idx >= 12) continue;
        score -= 60;
      }

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
