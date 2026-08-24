// Gmail → Candidate Grid hydration. Reads live Gmail (read-only), parses the
// email body plus the attached CV, classifies with the existing pipeline and
// returns candidate rows. Nothing is written to the ATS here: the explicit
// "Add to database" action still owns that.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAttachmentBytes, getMessage } from "./gmail.server";
import { gmailMessageToRawItem } from "./gmail-discovery.server";
import { classifyItem } from "./pipeline/classify.server";
import { cleanBodyText, extractDeterministic, sha256Bytes } from "./pipeline/normalize.server";
import { emptyMetrics } from "./pipeline/types";
import { candidateEvidence, heuristicScore, isCandidateArtifact } from "./recruitment-classify.server";
import {
  candidateKey,
  extractCurrentCtc,
  extractExpectedCtc,
  extractNoticePeriod,
  mergeCandidateRows,
  type GridCandidate,
} from "./mailbox-grid";

async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

/**
 * Hydrate one page of Gmail message refs into candidate rows.
 * Messages with no candidate in them are dropped rather than shown as noise.
 */
export async function hydrateCandidatePage(args: {
  userId: string;
  accessToken: string;
  googleEmail: string | null;
  refs: { id: string; threadId: string }[];
}): Promise<GridCandidate[]> {
  const metrics = emptyMetrics();
  const mine = (args.googleEmail ?? "").toLowerCase() || null;

  const one = async (ref: { id: string; threadId: string }): Promise<GridCandidate | null> => {
    try {
      const msg = await getMessage(args.accessToken, ref.id);
      const raw = gmailMessageToRawItem(msg, ref.threadId);
      const bodyText = cleanBodyText(raw.bodyText);
      const attNames = raw.attachments.map((a) => a.fileName);
      const baseSignal = {
        fromEmail: raw.fromEmail,
        fromName: raw.fromName,
        toEmails: raw.toEmails,
        myEmail: mine,
        subject: raw.subject,
        bodyText,
        attachmentNames: attNames,
        docText: "",
        threadKnown: false,
      };

      // Cheap gate first: obvious non-recruitment mail never costs a download.
      const pre = heuristicScore(baseSignal);
      const preEv = candidateEvidence(baseSignal);
      if (!raw.attachments.length && pre.score <= 12 && preEv.score <= 12 && !preEv.uncertainty) return null;

      // The CV is the higher-confidence source for structured fields.
      let docText = "";
      const primary = raw.attachments[0] ?? null;
      if (primary) {
        try {
          const bytes = await getAttachmentBytes(args.accessToken, ref.id, primary.externalId);
          const hash = await sha256Bytes(bytes);
          const { data: known } = await supabaseAdmin
            .from("email_resume_versions")
            .select("extracted_text")
            .eq("user_id", args.userId)
            .eq("content_sha256", hash)
            .not("extracted_text", "is", null)
            .limit(1)
            .maybeSingle();
          if (known?.extracted_text) {
            docText = known.extracted_text as string;
          } else {
            const { extractCvText } = await import("./cv-parse.server");
            docText = await extractCvText(bytes, primary.fileName, primary.mimeType);
          }
        } catch {
          docText = "";
        }
      }

      const det = extractDeterministic({
        fromEmail: raw.fromEmail,
        fromName: raw.fromName,
        cleanBody: bodyText,
        docText,
        primaryFileName: primary?.fileName ?? null,
      });
      const cls = await classifyItem({
        userId: args.userId,
        signal: { ...baseSignal, docText },
        deterministic: det.fields,
        gaps: det.gaps,
        attachmentHashes: [],
        metrics,
      });

      // The grid is a people view: job descriptions and admin mail are not rows.
      if (cls.decision === "skip" || !isCandidateArtifact(cls.artifact)) return null;

      const ex = cls.extracted;
      // Resume text first, then the email body — the CV states compensation more reliably.
      const combined = `${docText}\n${bodyText}`;
      const row: GridCandidate = {
        key: candidateKey({ ...ex, messageId: ref.id }),
        name: ex.name ?? null,
        email: ex.email ?? null,
        phone: ex.phone ?? null,
        role: ex.role ?? null,
        company: ex.current_company ?? null,
        experience: ex.experience ?? null,
        location: ex.location ?? null,
        skills: ex.skills ?? [],
        currentCtc: extractCurrentCtc(combined),
        expectedCtc: extractExpectedCtc(combined),
        noticePeriod: extractNoticePeriod(combined),
        confidence: cls.confidence,
        unread: (msg.labelIds ?? []).includes("UNREAD"),
        sources: [
          {
            messageId: ref.id,
            threadId: ref.threadId,
            subject: raw.subject,
            fromName: raw.fromName,
            fromEmail: raw.fromEmail,
            sentAt: raw.sentAt,
            attachmentNames: attNames,
            hasResume: !!primary,
          },
        ],
      };
      return row;
    } catch {
      return null;
    }
  };

  const rows = (await pool(args.refs, 8, one)).filter((r): r is GridCandidate => !!r);
  return mergeCandidateRows(rows);
}
