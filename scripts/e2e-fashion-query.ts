// Diagnostic: run the production ranking gate over REAL mailbox candidates.
import { getValidAccessToken } from "@/lib/google-calendar.server";
import { listMessageIds, getMessage, getAttachmentBytes } from "@/lib/gmail.server";
import { gmailMessageToRawItem } from "@/lib/gmail-discovery.server";
import { pickPrimaryCandidateAttachment } from "@/lib/candidate-attachment";
import { cleanBodyText, extractDeterministic } from "@/lib/pipeline/normalize.server";
import { extractCvText } from "@/lib/cv-parse.server";
import { rankItem } from "@/lib/search/rank.server";
import { planSearch } from "@/lib/search/query-plan.server";

const USER_ID = process.env.E2E_USER_ID!;
const QUERY = "Fashion designers with 3+ years experience in Delhi or Mumbai";

const conn = (await getValidAccessToken(USER_ID))!;
const { plan } = await planSearch(QUERY);
console.log("plan roles:", plan.roles, "| locations:", plan.locations, "| minYears:", plan.minYears);

const page = await listMessageIds(conn.access_token, "has:attachment -in:spam -in:trash", null, 12);
for (const ref of page.messages) {
  const msg = await getMessage(conn.access_token, ref.id);
  const raw = gmailMessageToRawItem(msg, ref.threadId);
  const primary = pickPrimaryCandidateAttachment(raw.attachments);
  if (!primary) continue;
  let docText = "";
  try {
    docText = await extractCvText(
      await getAttachmentBytes(conn.access_token, ref.id, primary.externalId),
      primary.fileName,
      primary.mimeType,
    );
  } catch {}
  const body = cleanBodyText(raw.bodyText);
  const det = extractDeterministic({
    fromEmail: raw.fromEmail,
    fromName: raw.fromName,
    cleanBody: body,
    docText,
    primaryFileName: primary.fileName,
  });
  const r = rankItem(plan, {
    extracted: det.fields,
    confidence: 70,
    hasResume: true,
    sentAt: raw.sentAt,
    haystack: `${docText}\n${body}`,
  });
  console.log({
    name: det.fields.name,
    role: det.fields.role,
    location: det.fields.location,
    qualified: r.qualified,
    score: r.score,
    why: r.parts,
  });
}
