type AttachmentLike = { fileName: string; mimeType?: string | null; size?: number | null };

const RESUME_NAME_RE = /(resume|resum|\bcv\b|curriculum|vitae|profile|candidate|biodata|bio[\s_-]?data)/i;
const DOCUMENT_EXT_RE = /\.(pdf|docx?|rtf|odt|txt)$/i;
const NOISE_NAME_RE = /(logo|image|signature|photo|statement|invoice|receipt|bill|ticket|policy|offer|jd\b|job[\s_.-]?desc|requirement|mandate)/i;

function scoreAttachment(a: AttachmentLike): number {
  const name = a.fileName ?? "";
  const mime = a.mimeType ?? "";
  let score = 0;
  if (RESUME_NAME_RE.test(name)) score += 40;
  if (DOCUMENT_EXT_RE.test(name)) score += 20;
  if (/pdf|word|document|rtf|text/i.test(mime)) score += 10;
  if ((a.size ?? 0) > 10_000) score += 5;
  if (NOISE_NAME_RE.test(name)) score -= 50;
  return score;
}

/** Pick the attachment most likely to be the candidate CV, not a logo/JD/etc. */
export function pickPrimaryCandidateAttachment<T extends AttachmentLike>(attachments: T[]): T | null {
  if (!attachments.length) return null;
  const ranked = [...attachments]
    .map((attachment, index) => ({ attachment, index, score: scoreAttachment(attachment) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const best = ranked[0];
  if (!best) return null;
  return best.score >= 0 ? best.attachment : attachments[0] ?? null;
}
