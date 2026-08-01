/** Presentation helpers shared by the Recruitment Memory screens. */

export const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";

export function relTime(v?: string | null) {
  if (!v) return "Never";
  const diff = Date.now() - new Date(v).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(v);
}

export function lpa(min: number | null, max: number | null) {
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${min}–${max} LPA`;
  return `${min ?? max} LPA`;
}

/** AI extraction sometimes stored the literal string "null" — never show it. */
export function txt(v?: string | null) {
  if (!v) return null;
  const t = v.trim();
  if (!t || /^(null|undefined|n\/a|na|none|unknown|-)$/i.test(t)) return null;
  return t;
}

export const KIND_LABEL: Record<string, string> = {
  candidate_submission: "Candidate submission",
  resume_forward: "Resume forward",
  job_application: "Job application",
  interview_scheduling: "Interview scheduling",
  recruiter_conversation: "Recruiter conversation",
  job_alert: "Job alert",
  bank_statement: "Bank / brokerage statement",
  invoice_receipt: "Invoice or receipt",
  travel: "Travel",
  order_shipping: "Order / shipping",
  newsletter_promo: "Newsletter or promotion",
  otp_security: "OTP / security",
  other: "Other",
};

export const ARTIFACT_FILTERS = [
  ["all", "Any outcome"],
  ["candidate_profile", "Candidate detected"],
  ["candidate_plus_conversation", "Candidate + conversation"],
  ["recruitment_conversation", "Recruitment conversation"],
  ["job_description", "Job description"],
  ["interview_feedback", "Interview feedback"],
  ["administrative", "No candidate found"],
] as const;

export function isCandidateArtifactLabel(a?: string | null) {
  return a === "candidate_profile" || a === "candidate_plus_conversation";
}

/**
 * Outcome chip: says what the email actually produced, not how "recruitment-y"
 * it looked. Candidate confidence only shows when a candidate was detected.
 */
export function OutcomeBadge({
  artifact,
  score,
  state,
  className,
}: {
  artifact?: string | null;
  score?: number | null;
  state: "imported" | "needs_review" | "skipped";
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(score ?? 0)));
  const a = artifact ?? (state === "imported" ? "candidate_profile" : "administrative");
  const isCandidate = isCandidateArtifactLabel(a);

  let label: string;
  let tone: string;
  if (state === "needs_review" && isCandidate) {
    label = "Possible candidate";
    tone = "bg-warning/10 text-warning border-warning/30";
  } else if (isCandidate) {
    label = a === "candidate_plus_conversation" ? "Candidate + conversation" : "Candidate detected";
    tone = "bg-success/10 text-success border-success/25";
  } else if (a === "job_description") {
    label = "Job description";
    tone = "bg-primary/10 text-primary border-primary/25";
  } else if (a === "recruitment_conversation") {
    label = "Recruitment conversation";
    tone = "bg-secondary text-muted-foreground border-border";
  } else if (a === "interview_feedback") {
    label = "Interview feedback";
    tone = "bg-secondary text-muted-foreground border-border";
  } else {
    label = "No candidate found";
    tone = "bg-muted text-muted-foreground border-border";
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${tone} ${className ?? ""}`}
      title={
        isCandidate
          ? `Candidate confidence — how sure we are this email holds an importable profile: ${pct}%`
          : "This email holds no importable candidate profile."
      }
    >
      {isCandidate && <span className="font-semibold">{pct}%</span>}
      {label}
    </span>
  );
}