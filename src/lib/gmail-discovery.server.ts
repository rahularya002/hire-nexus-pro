// DISCOVERY stage for Gmail. The only Gmail-specific part of the pipeline —
// everything downstream works on the source-agnostic RawItem shape.
import {
  findResumeAttachments,
  getBodyText,
  header,
  parseAddress,
  parseAddressList,
  type GmailMessage,
} from "./gmail.server";
import type { RawItem } from "./pipeline/types";

export function gmailMessageToRawItem(msg: GmailMessage, threadId: string | null): RawItem {
  const from = parseAddress(header(msg, "From"));
  const dateHeader = header(msg, "Date");
  const sentAt = msg.internalDate
    ? new Date(Number(msg.internalDate)).toISOString()
    : dateHeader
      ? new Date(dateHeader).toISOString()
      : null;

  return {
    source: "gmail",
    externalId: msg.id,
    threadId,
    subject: header(msg, "Subject"),
    snippet: msg.snippet ?? null,
    fromEmail: from.email,
    fromName: from.name,
    toEmails: parseAddressList(header(msg, "To")),
    bodyText: getBodyText(msg),
    sentAt,
    attachments: findResumeAttachments(msg).map((a) => ({
      externalId: a.attachmentId,
      fileName: a.filename,
      mimeType: a.mimeType,
      size: a.size,
    })),
  };
}