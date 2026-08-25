import { candidateNameFromFile } from "./candidate-identity";

export type CandidateResumeEvidence = {
  file_name: string | null;
  extracted_text?: string | null;
  storage_path?: string | null;
};

export type CandidateIdentityHint = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

const lower = (s: string | null | undefined) => (s ?? "").toLowerCase();
const digits = (s: string | null | undefined) => (s ?? "").replace(/\D+/g, "");

function wordTokens(s: string | null | undefined): string[] {
  return lower(s)
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length >= 3);
}

function emailLocalTokens(email: string | null | undefined): string[] {
  const local = lower(email).split("@")[0] ?? "";
  return wordTokens(local.replace(/[0-9]+/g, " "));
}

function scoreResumeForCandidate(resume: CandidateResumeEvidence, hint: CandidateIdentityHint): number {
  const text = lower(resume.extracted_text);
  const file = lower(resume.file_name);
  const fileNameCandidate = candidateNameFromFile(resume.file_name);
  const fileCandidateTokens = wordTokens(fileNameCandidate);
  const nameTokens = wordTokens(hint.name);
  const emailTokens = emailLocalTokens(hint.email);
  const phoneDigits = digits(hint.phone);
  const phoneTail = phoneDigits.length >= 8 ? phoneDigits.slice(-10) : null;
  let score = 0;

  if (hint.email && text.includes(lower(hint.email))) score += 80;
  if (phoneTail && digits(text).includes(phoneTail)) score += 70;

  for (const token of nameTokens) {
    if (text.includes(token)) score += 18;
    if (file.includes(token)) score += 14;
    if (fileCandidateTokens.includes(token)) score += 18;
  }
  for (const token of emailTokens) {
    if (text.includes(token)) score += 12;
    if (file.includes(token)) score += 20;
    if (fileCandidateTokens.includes(token)) score += 18;
  }

  if ((resume.extracted_text ?? "").trim()) score += 4;
  if (fileNameCandidate) score += 2;
  return score;
}

/**
 * Archive rows can contain several forwarded CVs when older imports merged too
 * aggressively. Pick the CV whose own text/filename best matches the candidate
 * identity instead of blindly taking the newest attachment.
 */
export function selectResumeForCandidate<T extends CandidateResumeEvidence>(
  resumes: T[],
  hint: CandidateIdentityHint,
): T | null {
  if (!resumes.length) return null;
  let best = resumes[0];
  let bestScore = scoreResumeForCandidate(best, hint);
  for (const resume of resumes.slice(1)) {
    const score = scoreResumeForCandidate(resume, hint);
    if (score > bestScore) {
      best = resume;
      bestScore = score;
    }
  }
  return best ?? null;
}