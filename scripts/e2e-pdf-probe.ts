// Diagnostic: inspect raw pdf.js text items for one real attachment.
import { getValidAccessToken } from "@/lib/google-calendar.server";
import { getMessage, getAttachmentBytes } from "@/lib/gmail.server";
import { gmailMessageToRawItem } from "@/lib/gmail-discovery.server";
import { pickPrimaryCandidateAttachment } from "@/lib/candidate-attachment";

const USER_ID = process.env.E2E_USER_ID!;
const MSG = process.env.E2E_MSG!;

const conn = await getValidAccessToken(USER_ID);
if (!conn) throw new Error("no connection");
const msg = await getMessage(conn.access_token, MSG);
const raw = gmailMessageToRawItem(msg, msg.threadId ?? null);
const primary = pickPrimaryCandidateAttachment(raw.attachments)!;
console.log("file:", primary.fileName, primary.mimeType, primary.size);
const bytes = await getAttachmentBytes(conn.access_token, MSG, primary.externalId);
const { getDocumentProxy, extractText } = await import("unpdf");
const pdf = await getDocumentProxy(bytes);
console.log("pages:", pdf.numPages);
const { text } = await extractText(pdf, { mergePages: true });
console.log("extractText length:", (Array.isArray(text) ? text.join("") : text ?? "").length);
const page = await pdf.getPage(1);
const content = await page.getTextContent();
console.log("items on page 1:", content.items.length);
console.log(
  JSON.stringify(
    (content.items as { str: string; transform?: number[] }[])
      .slice(0, 25)
      .map((i) => [i.str, i.transform?.[5]]),
  ),
);
