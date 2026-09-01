// One-off diagnostic: run the REAL production Gmail → CV → candidate-row path
// against the connected mailbox. Not imported by the app.
import { getValidAccessToken } from "@/lib/google-calendar.server";
import { listMessageIds, getMessage, getAttachmentBytes } from "@/lib/gmail.server";
import { gmailMessageToRawItem } from "@/lib/gmail-discovery.server";
import { pickPrimaryCandidateAttachment } from "@/lib/candidate-attachment";
import { cleanBodyText, extractDeterministic } from "@/lib/pipeline/normalize.server";
import { hydrateCandidatePage } from "@/lib/mailbox-grid.server";

const USER_ID = process.env.E2E_USER_ID!;

function mask(s: string | null | undefined) {
  if (!s) return String(s);
  return s.length <= 6 ? s : `${s.slice(0, 3)}***${s.slice(-3)}`;
}

const conn = await getValidAccessToken(USER_ID);
if (!conn) throw new Error("no gmail connection");
console.log("connected as", conn.google_email, "scopes:", conn.scopes);

const page = await listMessageIds(conn.access_token, "has:attachment -in:spam -in:trash", null, 25);
console.log("message refs:", page.messages.length);

let tested = 0;
for (const ref of page.messages) {
  const msg = await getMessage(conn.access_token, ref.id);
  const raw = gmailMessageToRawItem(msg, ref.threadId);
  const primary = pickPrimaryCandidateAttachment(raw.attachments);
  if (!primary) continue;
  console.log("\n=== MESSAGE", ref.id);
  console.log("sender:", raw.fromName, "<" + raw.fromEmail + ">");
  console.log("subject:", raw.subject);
  console.log("attachment:", primary.fileName, primary.mimeType, primary.size);

  const bytes = await getAttachmentBytes(conn.access_token, ref.id, primary.externalId);
  const { extractCvText } = await import("@/lib/cv-parse.server");
  let docText = "";
  try {
    docText = await extractCvText(bytes, primary.fileName, primary.mimeType);
  } catch (e) {
    console.log("EXTRACT ERROR", (e as Error).message);
  }
  console.log("cv text length:", docText.length);
  console.log(
    "header lines:",
    JSON.stringify(docText.split(/\n/).map((l) => l.trim()).filter(Boolean).slice(0, 6)),
  );

  const det = extractDeterministic({
    fromEmail: raw.fromEmail,
    fromName: raw.fromName,
    cleanBody: cleanBodyText(raw.bodyText),
    docText,
    primaryFileName: primary.fileName,
  });
  console.log("deterministic name:", det.fields.name);
  console.log("deterministic email:", mask(det.fields.email), "phone:", mask(det.fields.phone));
  console.log("deterministic role:", det.fields.role, "| company:", det.fields.current_company);

  const rows = await hydrateCandidatePage({
    userId: USER_ID,
    accessToken: conn.access_token,
    googleEmail: conn.google_email,
    refs: [ref],
  });
  console.log(
    "GRID ROWS:",
    rows.map((r) => ({
      name: r.name,
      role: r.role,
      email: mask(r.email),
      phone: mask(r.phone),
      exp: r.experience,
      loc: r.location,
      src: r.sources.map((s) => `${s.fromName} <${s.fromEmail}>`),
    })),
  );
  if (++tested >= 8) break;
}
console.log("\ntested messages with CV:", tested);
