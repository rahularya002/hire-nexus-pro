// CLASSIFICATION stage — "does this email contain an importable candidate?"
// Rules first, cache second, model only for the genuinely uncertain middle.
import {
  ARTIFACT_TYPES,
  candidateEvidence,
  cleanExtracted,
  heuristicScore,
  isCandidateArtifact,
  normalizeArtifact,
  type ArtifactType,
  type CandidateEvidence,
  type Classification,
  type EmailKind,
  type Extracted,
  type SignalInput,
} from "../recruitment-classify.server";
import { emailCacheKey, readCache, resumeCacheKey, writeCache } from "./cache.server";
import {
  AI_MAX_BODY_CHARS,
  AI_MAX_DOC_CHARS,
  CANDIDATE_AUTO_ACCEPT_THRESHOLD,
  CANDIDATE_IMPORT_THRESHOLD,
  CANDIDATE_SKIP_THRESHOLD,
  type Facet,
} from "./config";
import { mergeFields } from "./normalize.server";
import type { PipelineMetrics } from "./types";

/** Legacy email_kind kept for display continuity, derived from the artifact. */
function kindForArtifact(a: ArtifactType, hasAttachment: boolean): EmailKind {
  switch (a) {
    case "candidate_profile":
      return hasAttachment ? "candidate_submission" : "job_application";
    case "candidate_plus_conversation":
      return "resume_forward";
    case "recruitment_conversation":
      return "recruiter_conversation";
    case "job_description":
      return "job_alert";
    case "interview_feedback":
      return "interview_scheduling";
    default:
      return "other";
  }
}

export const ARTIFACT_LABEL: Record<ArtifactType, string> = {
  candidate_profile: "Candidate detected",
  candidate_plus_conversation: "Candidate + conversation",
  recruitment_conversation: "Recruitment conversation",
  job_description: "Job description",
  interview_feedback: "Interview feedback",
  administrative: "No candidate found",
};

type FacetSchema = { property: string; type: "string" | "number" | "array" };

const FACET_FIELDS: Record<Facet, FacetSchema[]> = {
  identity: [{ property: "name", type: "string" }],
  contact: [
    { property: "email", type: "string" },
    { property: "phone", type: "string" },
  ],
  experience: [
    { property: "role", type: "string" },
    { property: "current_company", type: "string" },
    { property: "experience", type: "string" },
    { property: "location", type: "string" },
  ],
  skills: [{ property: "skills", type: "array" }],
};

function buildSchema(gaps: Facet[]) {
  const properties: Record<string, unknown> = {
    artifact_type: { type: "string", enum: ARTIFACT_TYPES },
    candidate_confidence: { type: "number" },
    reason: { type: "string" },
  };
  const required = ["artifact_type", "candidate_confidence", "reason"];

  for (const facet of gaps) {
    for (const f of FACET_FIELDS[facet]) {
      properties[f.property] =
        f.type === "array"
          ? { type: ["array", "null"], items: { type: "string" } }
          : { type: [f.type, "null"] };
      required.push(f.property);
    }
  }
  return { type: "object", properties, required, additionalProperties: false };
}

type AiResult = {
  artifact_type?: string | null;
  candidate_confidence?: number | null;
  reason?: string | null;
} & Partial<Extracted>;

async function callModel(i: SignalInput, gaps: Facet[]): Promise<{ result: AiResult | null; chars: number }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { result: null, chars: 0 };

  const context = [
    `From: ${i.fromName ?? ""} <${i.fromEmail ?? "unknown"}>`,
    `Subject: ${i.subject ?? ""}`,
    `Attachments: ${i.attachmentNames.join(", ") || "none"}`,
    i.threadKnown ? "Thread hint: earlier mail in this thread was recruitment-related." : "",
    "",
    "--- EMAIL BODY ---",
    i.bodyText.slice(0, AI_MAX_BODY_CHARS),
    "",
    "--- ATTACHED DOCUMENT TEXT ---",
    (i.docText ?? "").slice(0, AI_MAX_DOC_CHARS),
  ]
    .filter(Boolean)
    .join("\n");

  const gapNote = gaps.length
    ? `If (and only if) the artifact contains a candidate, also fill these missing fields: ${gaps.join(", ")}. Leave anything you are unsure about null.`
    : "Do not extract any candidate fields; only classify.";

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You decide what recruitment artifact an email primarily CONTAINS, so a recruiter database can import candidates. " +
              "Pick exactly one artifact_type: " +
              "candidate_profile (a specific person's resume/CV/profile is attached or written out), " +
              "candidate_plus_conversation (a candidate profile plus recruiter discussion), " +
              "recruitment_conversation (recruiter/candidate/client discussion, follow-ups, scheduling — NO importable profile), " +
              "job_description (a role, requirement or JD being shared — describes a job, not a person), " +
              "interview_feedback (evaluation of an interview), " +
              "administrative (anything else: statements, invoices, payments, OTP, orders, travel, newsletters, job alerts). " +
              "candidate_confidence (0-100) answers ONLY: how confident are you that this email contains a candidate profile that can be imported as a person record? " +
              "An email can be 100% recruitment related and still have candidate_confidence 0 — that is normal and correct for JDs and conversations. " +
              "Never call a document a resume just because it is a PDF. Be conservative: use 40-70 when genuinely ambiguous. " +
              gapNote +
              " Reply ONLY through the classify_email tool.",
          },
          { role: "user", content: context },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_email",
              description: "Identify the primary recruitment artifact in an email and how importable a candidate it holds.",
              parameters: buildSchema(gaps),
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "classify_email" } },
      }),
    });
    if (!res.ok) return { result: null, chars: context.length };
    const json = (await res.json()) as {
      choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
    };
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    return { result: args ? (JSON.parse(args) as AiResult) : null, chars: context.length };
  } catch {
    return { result: null, chars: context.length };
  }
}

export type ClassifyContext = {
  userId: string;
  signal: SignalInput;
  deterministic: Extracted;
  gaps: Facet[];
  attachmentHashes: string[];
  metrics: PipelineMetrics;
};

/**
 * Rules → bands → cache → model. Most items never reach the model at all.
 */
export async function classifyItem(
  ctx: ClassifyContext,
): Promise<Classification & { route: "rules-import" | "rules-skip" | "cache" | "ai" }> {
  const { signal, metrics } = ctx;
  const h = heuristicScore(signal);
  const ev = candidateEvidence(signal);
  const det = cleanExtracted(ctx.deterministic);
  const hasAttachment = signal.attachmentNames.length > 0;
  // A resume attachment is itself strong identity evidence: name-only (or
  // sender-email-only) extraction still produces a usable person record that the
  // recruiter can correct later. Only attachment-free mail needs a full identity.
  const hasPerson = hasAttachment
    ? !!det.name || !!det.email || !!det.phone
    : !!det.name && (!!det.email || !!det.phone);

  const sig = (ai: number | null) => ({
    heuristic: h.score,
    ai,
    hits: [...ev.hits, ...h.hits],
    blocks: [...ev.against, ...h.blocks],
    candidateEvidence: ev.score,
    uncertainty: ev.uncertainty,
  });

  // Band 1 — a candidate is plainly here and we already know who it is.
  if (
    ev.score >= CANDIDATE_IMPORT_THRESHOLD &&
    hasPerson &&
    !h.hardBlock &&
    (!ev.uncertainty || (hasAttachment && ev.score >= CANDIDATE_AUTO_ACCEPT_THRESHOLD))
  ) {
    metrics.autoImported++;
    return {
      confidence: ev.score,
      kind: kindForArtifact(ev.artifact, hasAttachment),
      artifact: ev.artifact,
      reason: `Candidate detected — ${ev.hits.slice(0, 2).join(", ") || "resume evidence"}.`,
      decision: "import",
      signals: sig(null),
      extracted: det,
      route: "rules-import",
    };
  }

  // Band 3 — no candidate evidence and nothing ambiguous. Log the artifact, never
  // ask a human: recruitment conversations and JDs are stored, not reviewed.
  if (ev.score <= CANDIDATE_SKIP_THRESHOLD && !ev.uncertainty) {
    metrics.rulesSkipped++;
    const reason =
      ev.artifact === "job_description"
        ? "Job description / hiring requirement — stored as requirement intelligence."
        : ev.artifact === "interview_feedback"
          ? "Interview feedback — stored in recruitment history."
          : ev.artifact === "recruitment_conversation"
            ? "Recruitment conversation with no candidate profile — stored in the archive."
            : h.blocks[0]
              ? `No candidate found — ${h.blocks[0]}.`
              : "No candidate profile found in this email.";
    return {
      confidence: ev.score,
      kind: kindForArtifact(ev.artifact, hasAttachment),
      artifact: ev.artifact,
      reason,
      decision: "skip",
      signals: sig(null),
      extracted: cleanExtracted({}),
      route: "rules-skip",
    };
  }

  // Band 2 — ambiguous. Try the caches before spending a call.
  const resumeKey = ctx.attachmentHashes[0] ? resumeCacheKey(ctx.attachmentHashes[0]) : null;
  const promptKey = await emailCacheKey({
    fromEmail: signal.fromEmail,
    subject: signal.subject,
    attachmentHashes: ctx.attachmentHashes,
    cleanBody: signal.bodyText,
  });

  for (const key of [promptKey, resumeKey].filter(Boolean) as string[]) {
    const cached = await readCache<AiResult>(ctx.userId, key);
    if (cached) {
      metrics.cacheHits++;
      return { ...fuse(h, ev, cached, det, hasAttachment), route: "cache" };
    }
  }

  const { result, chars } = await callModel(signal, ctx.gaps);
  metrics.aiCalls++;
  metrics.tokensEstimated += Math.ceil(chars / 4);

  if (result) {
    await writeCache(ctx.userId, promptKey, "email", result);
    if (resumeKey) await writeCache(ctx.userId, resumeKey, "resume", result);
  }

  return { ...fuse(h, ev, result, det, hasAttachment), route: "ai" };
}

function fuse(
  h: ReturnType<typeof heuristicScore>,
  ev: CandidateEvidence,
  ai: AiResult | null,
  deterministic: Extracted,
  hasAttachment: boolean,
): Classification {
  const aiConf =
    typeof ai?.candidate_confidence === "number"
      ? Math.max(0, Math.min(100, Math.round(ai.candidate_confidence)))
      : null;
  const artifact: ArtifactType = ai?.artifact_type ? normalizeArtifact(ai.artifact_type) : ev.artifact;
  const candidateArtifact = isCandidateArtifact(artifact);

  let score: number;
  if (aiConf == null) {
    score = Math.min(ev.score, CANDIDATE_IMPORT_THRESHOLD - 1);
  } else {
    score = Math.round(aiConf * 0.7 + ev.score * 0.3);
    if (!candidateArtifact) score = Math.min(score, CANDIDATE_SKIP_THRESHOLD);
    if (h.hardBlock) score = Math.min(score, 20);
  }
  score = Math.max(0, Math.min(100, score));

  const extracted = cleanExtracted(mergeFields(deterministic, ai ?? {}));
  const hasPerson = hasAttachment
    ? !!extracted.name || !!extracted.email || !!extracted.phone
    : !!extracted.name && (!!extracted.email || !!extracted.phone || (extracted.skills?.length ?? 0) > 0);

  let decision: Classification["decision"];
  if (!candidateArtifact) {
    // Recruitment context without a person never costs a recruiter a review.
    decision = "skip";
  } else if (score >= CANDIDATE_AUTO_ACCEPT_THRESHOLD && hasPerson && !h.hardBlock) {
    // High candidate confidence is trusted outright — a recruiter adds nothing
    // by confirming what we are already 85%+ sure about.
    decision = "import";
  } else if (score >= CANDIDATE_IMPORT_THRESHOLD && hasPerson && !ev.uncertainty && !h.hardBlock) {
    decision = "import";
  } else if (score <= CANDIDATE_SKIP_THRESHOLD && !ev.uncertainty) {
    decision = "skip";
  } else {
    // Genuine uncertainty about whether an importable candidate is in here.
    decision = "review";
  }

  const fallbackReason = candidateArtifact
    ? ev.uncertainty
      ? `Possible candidate — ${ev.uncertainty}.`
      : `Candidate signals: ${ev.hits.slice(0, 2).join(", ") || "resume evidence"}.`
    : artifact === "job_description"
      ? "Job description / hiring requirement — stored as requirement intelligence."
      : artifact === "interview_feedback"
        ? "Interview feedback — stored in recruitment history."
        : artifact === "recruitment_conversation"
          ? "Recruitment conversation with no candidate profile — stored in the archive."
          : "No candidate profile found in this email.";

  const reason = (typeof ai?.reason === "string" && ai.reason.trim()) || fallbackReason;

  return {
    confidence: score,
    kind: kindForArtifact(artifact, hasAttachment),
    artifact,
    reason,
    decision,
    signals: {
      heuristic: h.score,
      ai: aiConf,
      hits: [...ev.hits, ...h.hits],
      blocks: [...ev.against, ...h.blocks],
      candidateEvidence: ev.score,
      uncertainty: ev.uncertainty,
    },
    extracted,
  };
}