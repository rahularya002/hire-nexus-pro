// Pure, client-safe evidence model for a search result. Decides what source a
// recruiter can inspect and which facts actually justify the match, so the card
// never claims evidence it cannot show.

export type EvidenceHit = {
  gmail_thread_id?: string | null;
  gmail_message_id?: string | null;
  resume_storage_path?: string | null;
  resume_file_name?: string | null;
  origin?: string | null;
  email_candidate_id?: string | null;
  subject?: string | null;
  score_parts?: { matched?: string[]; missing?: string[] } | null;
  extracted?: {
    name?: string | null;
    role?: string | null;
    location?: string | null;
    experience?: string | null;
    current_company?: string | null;
    skills?: string[] | null;
  } | null;
};

/** Which inspect action the card can honestly offer. */
export type SourceState = "email" | "attachment" | "multiple" | "none";

const isArchiveId = (id?: string | null) => !!id && id.startsWith("archive:");

export function hasEmailSource(hit: EvidenceHit): boolean {
  return !!hit.gmail_thread_id && !isArchiveId(hit.gmail_message_id);
}

export function hasAttachmentSource(hit: EvidenceHit): boolean {
  return !!(hit.resume_storage_path || hit.resume_file_name);
}

/** Archive people can have several stored resumes / mails behind one result. */
export function sourceState(hit: EvidenceHit): SourceState {
  const email = hasEmailSource(hit);
  const att = hasAttachmentSource(hit);
  if (email && att) return "multiple";
  if (email) return "email";
  if (att) return "attachment";
  // An archive person always has stored mail behind them, even without a file.
  if (hit.origin === "archive" && hit.email_candidate_id) return "multiple";
  return "none";
}

export function sourceLabel(state: SourceState): string {
  switch (state) {
    case "email":
      return "Open email";
    case "attachment":
      return "View resume";
    case "multiple":
      return "View more";
    default:
      return "View more";
  }
}

export type EvidenceChip = { label: string; kind: "role" | "years" | "location" | "company" | "skill" | "file" };

const NOISE = /^(senior|sr|jr|junior|mid|mid-level|lead|principal|staff|chief|head|associate|entry|fresher|years?|yrs?|experience|candidates?|people|profiles?|resume|cv)$/i;

function yearsLabel(experience?: string | null): string | null {
  const m = (experience ?? "").match(/(\d{1,2}(?:\.\d)?)/);
  return m ? `${m[1]} yrs` : null;
}

/**
 * Facts that are actually supported by the candidate's own extracted profile.
 * Query words with no backing (e.g. "senior") are deliberately excluded.
 */
export function evidenceChips(hit: EvidenceHit): EvidenceChip[] {
  const ex = hit.extracted ?? {};
  const chips: EvidenceChip[] = [];
  const seen = new Set<string>();
  const push = (label: string | null | undefined, kind: EvidenceChip["kind"]) => {
    const t = (label ?? "").trim();
    if (!t || NOISE.test(t)) return;
    const key = `${kind}:${t.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    chips.push({ label: t, kind });
  };

  push(ex.role, "role");
  push(yearsLabel(ex.experience), "years");
  push(ex.location, "location");
  push(ex.current_company, "company");

  // Only skills the candidate's own profile lists, intersected with what ranked.
  const own = (ex.skills ?? []).map((s) => (s ?? "").trim()).filter(Boolean);
  const matched = (hit.score_parts?.matched ?? []).map((m) => m.toLowerCase());
  const skillEvidence = own.filter((s) => matched.includes(s.toLowerCase()));
  for (const s of (skillEvidence.length ? skillEvidence : own).slice(0, 3)) push(s, "skill");

  if (hasAttachmentSource(hit)) push(hit.resume_file_name || "Resume attached", "file");
  return chips.slice(0, 7);
}