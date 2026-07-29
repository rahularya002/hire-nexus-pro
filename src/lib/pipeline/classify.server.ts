// CLASSIFICATION stage — rules first, cache second, model only for what is left.
import {
  cleanExtracted,
  heuristicScore,
  type Classification,
  type EmailKind,
  type Extracted,
  type SignalInput,
} from "../recruitment-classify.server";
import { emailCacheKey, readCache, resumeCacheKey, writeCache } from "./cache.server";
import { AI_MAX_BODY_CHARS, AI_MAX_DOC_CHARS, AUTO_IMPORT_THRESHOLD, SKIP_THRESHOLD, type Facet } from "./config";
import { mergeFields } from "./normalize.server";
import type { PipelineMetrics } from "./types";

const RECRUITMENT_KINDS: EmailKind[] = [
  "candidate_submission",
  "resume_forward",
  "job_application",
  "interview_scheduling",
  "recruiter_conversation",
];

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
    is_recruitment: { type: "boolean" },
    confidence: { type: "number" },
    email_kind: {
      type: "string",
      enum: [
        "candidate_submission","resume_forward","job_application","interview_scheduling",
        "recruiter_conversation","job_alert","bank_statement","invoice_receipt","travel",
        "order_shipping","newsletter_promo","otp_security","other",
      ],
    },
    reason: { type: "string" },
  };
  const required = ["is_recruitment", "confidence", "email_kind", "reason"];

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
  is_recruitment?: boolean | null;
  confidence?: number | null;
  email_kind?: string | null;
  reason?: string | null;
} & Partial<Extracted>;

function normalizeKind(v: unknown): EmailKind {
  const k = typeof v === "string" ? (v as EmailKind) : "other";
  const all: EmailKind[] = [
    ...RECRUITMENT_KINDS,"job_alert","bank_statement","invoice_receipt","travel",
    "order_shipping","newsletter_promo","otp_security","other",
  ];
  return all.includes(k) ? k : "other";
}

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
    ? `Also fill only these missing fields: ${gaps.join(", ")}. Leave anything you are unsure about null.`
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
              "You classify a recruiter's email using sender, subject, body, attachment names and attached document text. Recruitment means a candidate resume or CV, a candidate submission or forward, a job application, interview scheduling, or a recruiter/candidate conversation. Bank or brokerage statements, invoices, receipts, payments, bills, taxes, OTP or security codes, orders, shipping, travel and newsletters are NOT recruitment. Never call a document a resume just because it is a PDF. Return confidence 0-100 and be conservative: use 40-70 when genuinely ambiguous. " +
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
              description: "Classify a recruiter email and fill only the requested missing fields.",
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
  const det = cleanExtracted(ctx.deterministic);
  const hasPerson = !!det.name && (!!det.email || !!det.phone);

  // Band 1 — confident enough on rules alone, and we already know who this is.
  if (h.score >= AUTO_IMPORT_THRESHOLD && hasPerson && !h.hardBlock) {
    metrics.autoImported++;
    return {
      confidence: h.score,
      kind: "candidate_submission",
      reason: `Clear recruitment mail — ${h.hits.slice(0, 2).join(", ") || "strong resume signals"}.`,
      decision: "import",
      signals: { heuristic: h.score, ai: null, hits: h.hits, blocks: h.blocks },
      extracted: det,
      route: "rules-import",
    };
  }

  // Band 3 — obvious noise never gets a model call.
  if (h.score <= SKIP_THRESHOLD) {
    metrics.rulesSkipped++;
    return {
      confidence: h.score,
      kind: "other",
      reason: h.blocks[0] ? `Looks like non-recruitment mail — ${h.blocks[0]}.` : "No recruitment signals found.",
      decision: "skip",
      signals: { heuristic: h.score, ai: null, hits: h.hits, blocks: h.blocks },
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
      return { ...fuse(h, cached, det), route: "cache" };
    }
  }

  const { result, chars } = await callModel(signal, ctx.gaps);
  metrics.aiCalls++;
  metrics.tokensEstimated += Math.ceil(chars / 4);

  if (result) {
    await writeCache(ctx.userId, promptKey, "email", result);
    if (resumeKey) await writeCache(ctx.userId, resumeKey, "resume", result);
  }

  return { ...fuse(h, result, det), route: "ai" };
}

function fuse(
  h: ReturnType<typeof heuristicScore>,
  ai: AiResult | null,
  deterministic: Extracted,
): Classification {
  const kind = normalizeKind(ai?.email_kind);
  const isRecruitKind = RECRUITMENT_KINDS.includes(kind);
  const aiConf = typeof ai?.confidence === "number" ? Math.max(0, Math.min(100, Math.round(ai.confidence))) : null;

  let score: number;
  if (aiConf == null) {
    score = Math.min(h.score, AUTO_IMPORT_THRESHOLD - 1);
  } else {
    score = Math.round(aiConf * 0.7 + h.score * 0.3);
    if (ai?.is_recruitment === false) score = Math.min(score, 30);
    if (!isRecruitKind) score = Math.min(score, kind === "job_alert" ? 40 : 25);
    if (h.blocks.length >= 2) score = Math.min(score, 55);
    if (h.hardBlock) score = Math.min(score, 30);
    if (h.hits.length >= 3 && isRecruitKind) score = Math.min(100, score + 5);
  }
  score = Math.max(0, Math.min(100, score));

  const extracted = cleanExtracted(mergeFields(deterministic, ai ?? {}));
  const hasPerson = !!extracted.name || !!extracted.email || (extracted.skills?.length ?? 0) > 0;

  let decision: Classification["decision"] =
    score >= AUTO_IMPORT_THRESHOLD ? "import" : score > SKIP_THRESHOLD ? "review" : "skip";
  // AI-confirmed recruitment mail with a real person should not need a human.
  if (decision === "review" && aiConf != null && aiConf >= 80 && isRecruitKind && hasPerson && !h.hardBlock) {
    decision = "import";
  }
  if (decision === "import" && !hasPerson) decision = "review";

  const reason =
    (typeof ai?.reason === "string" && ai.reason.trim()) ||
    (h.hits[0] ? `Recruitment signals: ${h.hits.slice(0, 2).join(", ")}.` : "Not enough recruitment evidence.");

  return {
    confidence: score,
    kind,
    reason,
    decision,
    signals: { heuristic: h.score, ai: aiConf, hits: h.hits, blocks: h.blocks },
    extracted,
  };
}