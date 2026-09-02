// Audit which line of the real CV the chosen candidate name came from. Masked.
import { getValidAccessToken } from "@/lib/google-calendar.server";
import { getMessage, getAttachmentBytes } from "@/lib/gmail.server";
import { gmailMessageToRawItem } from "@/lib/gmail-discovery.server";
import { pickPrimaryCandidateAttachment } from "@/lib/candidate-attachment";
import { cleanBodyText, extractDeterministic } from "@/lib/pipeline/normalize.server";

const USER_ID = process.env.E2E_USER_ID!;
const MSG = process.env.E2E_MSG_ID!;
const shape = (s: string) => s.replace(/[A-Za-z]/g, "x").replace(/\d/g, "#");

const conn = (await getValidAccessToken(USER_ID))!;
const msg = await getMessage(conn.access_token, MSG);
const raw = gmailMessageToRawItem(msg, msg.threadId ?? null);
const primary = pickPrimaryCandidateAttachment(raw.attachments)!;
const bytes = await getAttachmentBytes(conn.access_token, MSG, primary.externalId);
const { extractCvText } = await import("@/lib/cv-parse.server");
const docText = await extractCvText(bytes, primary.fileName, primary.mimeType);
const lines = docText.split("\n").map((l) => l.trim()).filter(Boolean);
const det = extractDeterministic({
  fromEmail: raw.fromEmail,
  fromName: raw.fromName,
  cleanBody: cleanBodyText(raw.bodyText),
  docText,
  primaryFileName: primary.fileName,
});
const name = det.fields.name ?? "";
console.log("file:", shape(primary.fileName));
console.log("chosen name shape:", shape(name), "| word count:", name.split(/\s+/).length);
console.log("first line index containing chosen name:", lines.findIndex((l) => l.toLowerCase().includes(name.toLowerCase())));
console.log("occurrences in doc:", docText.toLowerCase().split(name.toLowerCase()).length - 1);
console.log("first 8 lines (shape only):", lines.slice(0, 8).map(shape));
const fileStem = primary.fileName.replace(/\.[^.]+$/, "").replace(/[^A-Za-z]+/g, " ").trim();
console.log("filename stem shape:", shape(fileStem), "| filename tokens appear in doc:",
  fileStem.split(/\s+/).map((t) => ({ t: shape(t), inDoc: docText.toLowerCase().includes(t.toLowerCase()) })));
console.log("chosen name equals a filename token set?", fileStem.toLowerCase().includes(name.split(/\s+/)[0]!.toLowerCase()));
