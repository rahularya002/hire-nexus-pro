// Server-only Gmail → Email Archive processing. Never imported from route/component code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildQuery,
  getAttachmentBytes,
  getMessage,
  listMessageIds,
} from "./gmail.server";
import {
  heuristicScore,
  candidateEvidence,
  isCandidateArtifact,
  type ArtifactType,
  type Extracted,
} from "./recruitment-classify.server";
import { gmailMessageToRawItem } from "./gmail-discovery.server";
import { classifyItem } from "./pipeline/classify.server";
import { cleanBodyText, extractDeterministic, sha256Bytes } from "./pipeline/normalize.server";
import { emptyMetrics } from "./pipeline/types";

export type { Extracted };

function digits(v?: string | null) {
  const d = (v ?? "").replace(/\D+/g, "");
  return d.length >= 8 ? d.slice(-10) : null;
}

function niceName(fileName: string, fallback: string | null) {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  const cleaned = base.replace(/\b(resume|cv|final|updated|new|copy|\d{2,})\b/gi, "").replace(/\s+/g, " ").trim();
  return cleaned.length >= 3 ? cleaned : fallback || "Unknown";
}

type Run = {
  id: string;
  agency_id: string;
  user_id: string;
  google_email: string | null;
  date_from: string | null;
  date_to: string | null;
  labels: string[];
  exclusions: string[];
  page_token: string | null;
  emails_scanned: number;
  resume_emails: number;
  people_found: number;
  people_enriched: number;
  duplicates_merged: number;
  failures: number;
  failure_log: unknown;
  skipped_non_resume?: number | null;
  needs_review?: number | null;
  skipped_noise?: number | null;
  ai_calls?: number | null;
  cache_hits?: number | null;
  auto_imported?: number | null;
  tokens_estimated?: number | null;
};

export type BatchResult = {
  done: boolean;
  scanned: number;
  skipped: number;
  needsReview: number;
  newPeople: { id: string; name: string; email: string | null }[];
};

export type StoredAttachment = {
  path: string;
  file_name: string;
  mime: string | null;
  size: number;
  extracted_text?: string | null;
  content_sha256?: string | null;
};

/** Everything needed to turn a classified email into an archive person. */
export type CandidatePayload = {
  agency_id: string;
  user_id: string;
  gmail_message_id: string;
  gmail_thread_id: string | null;
  subject: string | null;
  snippet: string | null;
  from_email: string | null;
  from_name: string | null;
  to_emails: string[];
  direction: string;
  sent_at: string | null;
  confidence: number;
  email_kind: string;
  artifact_type?: ArtifactType | string | null;
  reason: string;
  signals: unknown;
  extracted: Extracted;
  attachments: StoredAttachment[];
  body_text?: string;
};

type Person = { id: string; skills: string[] | null; resume_count: number; email_count: number };

/**
 * Create (or enrich) an archive person from a classified recruitment email.
 * Shared by the importer and the "approve from review" action.
 */
export async function upsertPersonFromPayload(
  payload: CandidatePayload,
): Promise<{ personId: string; name: string; email: string | null; merged: boolean }> {
  const ex = payload.extracted;
  const primary = payload.attachments[0] ?? null;
  const email =
    (ex.email ?? "").toLowerCase() ||
    (payload.direction === "inbound" ? payload.from_email : payload.to_emails[0]) ||
    null;
  const phoneDigits = digits(ex.phone);
  const name = ex.name || payload.from_name || (primary ? niceName(primary.file_name, email) : email) || "Unknown";
  const skills = (ex.skills ?? []).slice(0, 30);

  let person: Person | null = null;
  if (email) {
    const { data } = await supabaseAdmin
      .from("email_candidates")
      .select("id, skills, resume_count, email_count")
      .eq("user_id", payload.user_id)
      .ilike("email", email)
      .maybeSingle();
    person = (data as Person | null) ?? null;
  }
  if (!person && phoneDigits) {
    const { data } = await supabaseAdmin
      .from("email_candidates")
      .select("id, skills, resume_count, email_count")
      .eq("user_id", payload.user_id)
      .eq("phone_digits", phoneDigits)
      .maybeSingle();
    person = (data as Person | null) ?? null;
  }

  const blob = [
    name,
    email,
    ex.role,
    ex.current_company,
    ex.location,
    skills.join(" "),
    payload.subject,
    (primary?.extracted_text ?? payload.body_text ?? "").slice(0, 8000),
  ]
    .filter(Boolean)
    .join(" \n ");

  let merged = false;
  if (person) {
    merged = true;
    const mergedSkills = Array.from(new Set([...(person.skills ?? []), ...skills])).slice(0, 40);
    await supabaseAdmin
      .from("email_candidates")
      .update({
        name,
        email: email ?? undefined,
        phone: ex.phone ?? undefined,
        phone_digits: phoneDigits ?? undefined,
        location: ex.location ?? undefined,
        role: ex.role ?? undefined,
        current_company: ex.current_company ?? undefined,
        experience: ex.experience ?? undefined,
        salary_min: ex.salary_min ?? undefined,
        salary_max: ex.salary_max ?? undefined,
        notes: ex.notes ?? undefined,
        skills: mergedSkills,
        resume_count: (person.resume_count ?? 0) + (payload.attachments.length ? 1 : 0),
        email_count: (person.email_count ?? 0) + 1,
        last_email_at: payload.sent_at,
        confidence: payload.confidence,
        review_status: "imported",
        email_kind: payload.email_kind,
        artifact_type: (payload.artifact_type as string | null) ?? null,
        classification_reason: payload.reason,
        signals: payload.signals as never,
        search_blob: blob.slice(0, 20_000),
      })
      .eq("id", person.id);
  } else {
    const { data: created, error: cErr } = await supabaseAdmin
      .from("email_candidates")
      .insert({
        agency_id: payload.agency_id,
        user_id: payload.user_id,
        name,
        email,
        phone: ex.phone,
        phone_digits: phoneDigits,
        location: ex.location,
        role: ex.role,
        current_company: ex.current_company,
        experience: ex.experience,
        salary_min: ex.salary_min ?? null,
        salary_max: ex.salary_max ?? null,
        notes: ex.notes,
        skills,
        resume_count: payload.attachments.length ? 1 : 0,
        email_count: 1,
        first_email_at: payload.sent_at,
        last_email_at: payload.sent_at,
        confidence: payload.confidence,
        review_status: "imported",
        email_kind: payload.email_kind,
        artifact_type: (payload.artifact_type as string | null) ?? null,
        classification_reason: payload.reason,
        signals: payload.signals as never,
        search_blob: blob.slice(0, 20_000),
      })
      .select("id, skills, resume_count, email_count")
      .single();
    if (cErr) throw new Error(cErr.message);
    person = created as unknown as Person;
  }

  const { data: msgRow, error: mErr } = await supabaseAdmin
    .from("email_messages")
    .upsert(
      {
        agency_id: payload.agency_id,
        user_id: payload.user_id,
        email_candidate_id: person!.id,
        gmail_message_id: payload.gmail_message_id,
        gmail_thread_id: payload.gmail_thread_id,
        subject: payload.subject,
        snippet: payload.snippet,
        from_email: payload.from_email,
        from_name: payload.from_name,
        to_emails: payload.to_emails,
        direction: payload.direction,
        has_resume: payload.attachments.length > 0,
        sent_at: payload.sent_at,
      },
      { onConflict: "user_id,gmail_message_id" },
    )
    .select("id")
    .single();
  if (mErr) throw new Error(mErr.message);

  for (const att of payload.attachments) {
    await supabaseAdmin.from("email_resume_versions").insert({
      agency_id: payload.agency_id,
      user_id: payload.user_id,
      email_candidate_id: person!.id,
      email_message_id: msgRow!.id as string,
      storage_path: att.path,
      file_name: att.file_name,
      mime: att.mime,
      size_bytes: att.size,
      content_sha256: att.content_sha256 ?? null,
      extracted_text: att.extracted_text ? att.extracted_text.slice(0, 200_000) : null,
      received_at: payload.sent_at,
    });
  }

  return { personId: person!.id, name, email, merged };
}

/** Process one page of candidate-looking emails for a run. */
export async function processRunBatch(run: Run, accessToken: string, pageSize = 8): Promise<BatchResult> {
  const query = buildQuery({
    dateFrom: run.date_from,
    dateTo: run.date_to,
    labels: run.labels,
    exclusions: run.exclusions,
  });

  const page = await listMessageIds(accessToken, query, run.page_token, pageSize);
  const newPeople: BatchResult["newPeople"] = [];
  const failures: { message: string; subject?: string }[] = [];

  let scanned = 0;
  let resumeEmails = 0;
  let peopleFound = 0;
  let enriched = 0;
  let merged = 0;
  let skipped = 0;
  let needsReview = 0;
  const metrics = emptyMetrics();

  const mine = (run.google_email ?? "").toLowerCase() || null;

  for (const ref of page.messages) {
    scanned++;
    try {
      const [{ data: seenMsg }, { data: seenSkip }] = await Promise.all([
        supabaseAdmin
          .from("email_messages")
          .select("id")
          .eq("user_id", run.user_id)
          .eq("gmail_message_id", ref.id)
          .maybeSingle(),
        supabaseAdmin
          .from("email_import_skips")
          .select("id")
          .eq("user_id", run.user_id)
          .eq("gmail_message_id", ref.id)
          .maybeSingle(),
      ]);
      if (seenMsg || seenSkip) continue;

      const msg = await getMessage(accessToken, ref.id);
      const raw = gmailMessageToRawItem(msg, ref.threadId ?? null);
      const attachments = raw.attachments;
      const from = { email: raw.fromEmail, name: raw.fromName };
      const subject = raw.subject;
      const toList = raw.toEmails;
      const bodyText = cleanBodyText(raw.bodyText);
      const sentAt = raw.sentAt;
      const direction = from.email && mine && from.email === mine ? "outbound" : "inbound";

      // Has this thread already produced recruitment mail for this user?
      let threadKnown = false;
      if (ref.threadId) {
        const { data: t } = await supabaseAdmin
          .from("email_messages")
          .select("id")
          .eq("user_id", run.user_id)
          .eq("gmail_thread_id", ref.threadId)
          .limit(1)
          .maybeSingle();
        threadKnown = !!t;
      }

      const attNames = attachments.map((a) => a.fileName);
      const baseSignal = {
        fromEmail: from.email,
        fromName: from.name,
        toEmails: toList,
        myEmail: mine,
        subject,
        bodyText,
        attachmentNames: attNames,
        docText: "",
        threadKnown,
      };

      const recordSkip = async (c: {
        confidence: number;
        kind: string;
        artifact?: string | null;
        reason: string;
        signals: unknown;
        status: "skipped" | "needs_review";
        payload?: CandidatePayload | null;
      }) => {
        await supabaseAdmin.from("email_import_skips").insert({
          agency_id: run.agency_id,
          user_id: run.user_id,
          run_id: run.id,
          gmail_message_id: ref.id,
          gmail_thread_id: ref.threadId ?? null,
          subject,
          snippet: msg.snippet ?? null,
          from_email: from.email,
          from_name: from.name,
          attachment_names: attNames,
          confidence: c.confidence,
          email_kind: c.kind,
          artifact_type: c.artifact ?? null,
          reason: c.reason,
          signals: c.signals as never,
          pending_payload: (c.payload ?? null) as never,
          status: c.status,
          sent_at: sentAt,
        });
      };

      // Cheapest gate of all: obvious noise is never even downloaded.
      const pre = heuristicScore(baseSignal);
      const preEv = candidateEvidence(baseSignal);
      if (pre.score <= 12 && preEv.score <= 12 && !preEv.uncertainty) {
        skipped++;
        metrics.rulesSkipped++;
        await recordSkip({
          confidence: preEv.score,
          kind: "other",
          artifact: preEv.artifact,
          reason: pre.blocks[0] ? `No candidate found — ${pre.blocks[0]}.` : "No candidate profile found in this email.",
          signals: { heuristic: pre.score, ai: null, hits: pre.hits, blocks: pre.blocks, candidateEvidence: preEv.score },
          status: "skipped",
        });
        continue;
      }

      // NORMALIZATION — download, hash, and read the primary attachment. Identical
      // resume bytes we have parsed before reuse the stored text instead of parsing again.
      let docText = "";
      let primaryBytes: Uint8Array | null = null;
      let primaryHash: string | null = null;
      const primary = attachments[0] ?? null;
      if (primary) {
        try {
          primaryBytes = await getAttachmentBytes(accessToken, ref.id, primary.externalId);
          primaryHash = await sha256Bytes(primaryBytes);
          const { data: known } = await supabaseAdmin
            .from("email_resume_versions")
            .select("extracted_text")
            .eq("user_id", run.user_id)
            .eq("content_sha256", primaryHash)
            .not("extracted_text", "is", null)
            .limit(1)
            .maybeSingle();
          if (known?.extracted_text) {
            docText = known.extracted_text as string;
            metrics.cacheHits++;
          } else {
            const { extractCvText } = await import("./cv-parse.server");
            docText = await extractCvText(primaryBytes, primary.fileName, primary.mimeType);
          }
        } catch {
          docText = "";
        }
      }

      const det = extractDeterministic({
        fromEmail: from.email,
        fromName: from.name,
        cleanBody: bodyText,
        docText,
        primaryFileName: primary?.fileName ?? null,
      });

      // CLASSIFICATION — rules, then cache, then (rarely) the model.
      const cls = await classifyItem({
        userId: run.user_id,
        signal: { ...baseSignal, docText },
        deterministic: det.fields,
        gaps: det.gaps,
        attachmentHashes: primaryHash ? [primaryHash] : [],
        metrics,
      });

      if (cls.decision === "skip") {
        skipped++;
        await recordSkip({
          confidence: cls.confidence,
          kind: cls.kind,
          artifact: cls.artifact,
          reason: cls.reason,
          signals: cls.signals,
          status: "skipped",
        });
        continue;
      }

      if (attachments.length) resumeEmails++;

      // Store attachments so both "import" and later "approve" keep the files.
      const stored: StoredAttachment[] = [];
      for (const att of attachments) {
        const safe = att.fileName.replace(/[^\w.\-]+/g, "_");
        const path = `email-archive/${run.user_id}/${ref.id}-${safe}`;
        const isPrimary = primary && att.externalId === primary.externalId;
        let hash = isPrimary ? primaryHash : null;
        try {
          const bytes =
            isPrimary && primaryBytes ? primaryBytes : await getAttachmentBytes(accessToken, ref.id, att.externalId);
          if (!hash) hash = await sha256Bytes(bytes);
          const up = await supabaseAdmin.storage
            .from("documents")
            .upload(path, bytes, { upsert: true, contentType: att.mimeType ?? undefined });
          if (up.error) throw new Error(up.error.message);
        } catch {
          continue;
        }
        stored.push({
          path,
          file_name: att.fileName,
          mime: att.mimeType,
          size: att.size,
          content_sha256: hash,
          extracted_text: isPrimary ? docText : null,
        });
      }

      const payload: CandidatePayload = {
        agency_id: run.agency_id,
        user_id: run.user_id,
        gmail_message_id: ref.id,
        gmail_thread_id: ref.threadId ?? null,
        subject,
        snippet: msg.snippet ?? null,
        from_email: from.email,
        from_name: from.name,
        to_emails: toList,
        direction,
        sent_at: sentAt,
        confidence: cls.confidence,
        email_kind: cls.kind,
        reason: cls.reason,
        signals: cls.signals,
        extracted: cls.extracted,
        attachments: stored,
        body_text: bodyText,
      };

      if (cls.decision === "review") {
        needsReview++;
        await recordSkip({
          confidence: cls.confidence,
          kind: cls.kind,
          reason: cls.reason,
          signals: cls.signals,
          status: "needs_review",
          payload,
        });
        continue;
      }

      // Attachment-free recruitment mail only enriches a known person's timeline.
      if (stored.length === 0) {
        const { data: existing } = await supabaseAdmin
          .from("email_messages")
          .select("email_candidate_id")
          .eq("user_id", run.user_id)
          .eq("gmail_thread_id", ref.threadId ?? "")
          .not("email_candidate_id", "is", null)
          .limit(1)
          .maybeSingle();
        if (!existing?.email_candidate_id) {
          needsReview++;
          await recordSkip({
            confidence: cls.confidence,
            kind: cls.kind,
            reason: `${cls.reason} No resume attached, so no profile was created.`,
            signals: cls.signals,
            status: "needs_review",
            payload,
          });
          continue;
        }
        await supabaseAdmin.from("email_messages").insert({
          agency_id: run.agency_id,
          user_id: run.user_id,
          email_candidate_id: existing.email_candidate_id as string,
          gmail_message_id: ref.id,
          gmail_thread_id: ref.threadId ?? null,
          subject,
          snippet: msg.snippet ?? null,
          from_email: from.email,
          from_name: from.name,
          to_emails: toList,
          direction,
          has_resume: false,
          sent_at: sentAt,
        });
        enriched++;
        continue;
      }

      const res = await upsertPersonFromPayload(payload);
      if (res.merged) {
        merged++;
        enriched++;
      } else {
        peopleFound++;
        newPeople.push({ id: res.personId, name: res.name, email: res.email });
      }
    } catch (e) {
      failures.push({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  const done = !page.nextPageToken;
  const prevLog = Array.isArray(run.failure_log) ? (run.failure_log as { message: string }[]) : [];
  await supabaseAdmin
    .from("email_import_runs")
    .update({
      page_token: page.nextPageToken,
      emails_scanned: run.emails_scanned + scanned,
      resume_emails: run.resume_emails + resumeEmails,
      people_found: run.people_found + peopleFound,
      people_enriched: run.people_enriched + enriched,
      duplicates_merged: run.duplicates_merged + merged,
      failures: run.failures + failures.length,
      skipped_non_resume: (run.skipped_non_resume ?? 0) + skipped,
      skipped_noise: (run.skipped_noise ?? 0) + skipped,
      needs_review: (run.needs_review ?? 0) + needsReview,
      ai_calls: (run.ai_calls ?? 0) + metrics.aiCalls,
      cache_hits: (run.cache_hits ?? 0) + metrics.cacheHits,
      auto_imported: (run.auto_imported ?? 0) + metrics.autoImported,
      tokens_estimated: (run.tokens_estimated ?? 0) + metrics.tokensEstimated,
      failure_log: [...prevLog, ...failures].slice(-50),
      status: done ? "completed" : "running",
      finished_at: done ? new Date().toISOString() : null,
    })
    .eq("id", run.id);

  return { done, scanned, skipped, needsReview, newPeople };
}
