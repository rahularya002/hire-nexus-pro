// One-off REAL end-to-end identity test: connected Gmail -> one real CV ->
// extraction -> candidate row (grid adapter). Read-only. Masked output.
import { getValidAccessToken } from "@/lib/google-calendar.server";
import { listMessageIds, getMessage, getAttachmentBytes } from "@/lib/gmail.server";
import { gmailMessageToRawItem } from "@/lib/gmail-discovery.server";
import { pickPrimaryCandidateAttachment } from "@/lib/candidate-attachment";
import { cleanBodyText, extractDeterministic } from "@/lib/pipeline/normalize.server";
import { hydrateCandidatePage } from "@/lib/mailbox-grid.server";

const USER_ID = process.env.E2E_USER_ID!;

const mask = (s: string | null | undefined) =>
  !s ? String(s) : s.length <= 6 ? "***" : `${s.slice(0, 2)}***${s.slice(-2)}`;
const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z]/g, "");

const conn = await getValidAccessToken(USER_ID);
if (!conn) throw new Error("STEP1 FAIL: no gmail connection for user");
console.log("STEP0 connection:", mask(conn.google_email), "| gmail.readonly:", conn.scopes.includes("gmail.readonly"));

const page = await listMessageIds(conn.access_token, "has:attachment -in:spam -in:trash", null, 30);
console.log("STEP1 discovery: message refs =", page.messages.length);

for (const ref of page.messages) {
  const msg = await getMessage(conn.access_token, ref.id);
  const raw = gmailMessageToRawItem(msg, ref.threadId);
  const primary = pickPrimaryCandidateAttachment(raw.attachments);
  if (!primary) continue;

  console.log("\n=== TESTING MESSAGE", ref.id);
  console.log("STEP1 PASS: recruitment mail with resume found | attachment:", primary.fileName, primary.mimeType, primary.size, "bytes");
  console.log("  sender (provenance only):", mask(raw.fromName), "<" + mask(raw.fromEmail) + ">");

  const bytes = await getAttachmentBytes(conn.access_token, ref.id, primary.externalId);
  console.log("STEP2", bytes.byteLength > 0 ? "PASS" : "FAIL", "attachment downloaded:", bytes.byteLength, "bytes");

  const { extractCvText } = await import("@/lib/cv-parse.server");
  let docText = "";
  try {
    docText = await extractCvText(bytes, primary.fileName, primary.mimeType);
  } catch (e) {
    console.log("STEP3 FAIL extract error:", (e as Error).message);
  }
  console.log("STEP3", docText.length > 50 ? "PASS" : "FAIL", "cv text chars:", docText.length);

  const det = extractDeterministic({
    fromEmail: raw.fromEmail,
    fromName: raw.fromName,
    cleanBody: cleanBodyText(raw.bodyText),
    docText,
    primaryFileName: primary.fileName,
  });
  console.log("STEP4 name detected:", det.fields.name ? "PASS" : "FAIL", "| name(masked):", mask(det.fields.name));
  console.log("  name === sender name?", norm(det.fields.name) === norm(raw.fromName) && !!det.fields.name);
  console.log("  email === sender email?", norm(det.fields.email) === norm(raw.fromEmail) && !!det.fields.email);
  console.log("  email present:", !!det.fields.email, "| phone present:", !!det.fields.phone, "| role:", det.fields.role);
  const nameInCv = det.fields.name
    ? docText.toLowerCase().replace(/\s+/g, " ").includes(det.fields.name.toLowerCase())
    : false;
  console.log("  name appears verbatim in CV text:", nameInCv);

  const rows = await hydrateCandidatePage({
    userId: USER_ID,
    accessToken: conn.access_token,
    googleEmail: conn.google_email,
    refs: [ref],
  });
  console.log("STEP5 grid rows:", rows.length);
  for (const r of rows) {
    console.log("  GRID ROW:", {
      name: mask(r.name),
      nameMatchesCvDerived: norm(r.name) === norm(det.fields.name),
      nameIsSenderName: !!r.name && norm(r.name) === norm(raw.fromName),
      emailIsSenderEmail: !!r.email && norm(r.email) === norm(raw.fromEmail),
      hasEmail: !!r.email,
      hasPhone: !!r.phone,
      role: r.role,
      experience: r.experience,
      location: r.location,
      confidence: r.confidence,
      sources: r.sources.length,
    });
  }
  break;
}
