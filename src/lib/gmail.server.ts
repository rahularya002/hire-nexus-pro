// Server-only Gmail API helpers. Imported dynamically from server-function handlers.

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export type GmailLabel = { id: string; name: string; type?: string };

async function gget<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${GMAIL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Gmail API ${path} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export async function listLabels(accessToken: string): Promise<GmailLabel[]> {
  const json = await gget<{ labels?: GmailLabel[] }>(accessToken, "/labels");
  return (json.labels ?? []).filter((l) => l.id !== "CHAT");
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

export function buildQuery(args: {
  dateFrom?: string | null;
  dateTo?: string | null;
  labels?: string[];
  exclusions?: string[];
}) {
  const parts: string[] = ["has:attachment", "(filename:pdf OR filename:doc OR filename:docx)"];
  if (args.dateFrom) parts.push(`after:${fmtDate(args.dateFrom)}`);
  if (args.dateTo) parts.push(`before:${fmtDate(args.dateTo)}`);
  const labels = (args.labels ?? []).filter(Boolean);
  if (labels.length === 1) parts.push(`label:"${labels[0]}"`);
  else if (labels.length > 1) parts.push(`{${labels.map((l) => `label:"${l}"`).join(" ")}}`);
  for (const ex of args.exclusions ?? []) {
    const v = ex.trim();
    if (!v) continue;
    parts.push(v.includes("@") ? `-from:${v}` : `-from:*@${v.replace(/^@/, "")}`);
  }
  return parts.join(" ");
}

export async function listMessageIds(
  accessToken: string,
  query: string,
  pageToken?: string | null,
  maxResults = 25,
) {
  const params = new URLSearchParams({ q: query, maxResults: String(maxResults) });
  if (pageToken) params.set("pageToken", pageToken);
  const json = await gget<{
    messages?: { id: string; threadId: string }[];
    nextPageToken?: string;
    resultSizeEstimate?: number;
  }>(accessToken, `/messages?${params.toString()}`);
  return {
    messages: json.messages ?? [],
    nextPageToken: json.nextPageToken ?? null,
    estimate: json.resultSizeEstimate ?? 0,
  };
}

type Part = {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { attachmentId?: string; size?: number; data?: string };
  parts?: Part[];
};

export type GmailMessage = {
  id: string;
  threadId: string;
  internalDate?: string;
  labelIds?: string[];
  snippet?: string;
  payload?: Part;
};

export async function getMessage(accessToken: string, id: string) {
  return gget<GmailMessage>(accessToken, `/messages/${encodeURIComponent(id)}?format=full`);
}

export function header(msg: GmailMessage, name: string): string | null {
  const h = msg.payload?.headers?.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h?.value ?? null;
}

export function parseAddress(raw: string | null) {
  if (!raw) return { name: null as string | null, email: null as string | null };
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || null, email: m[2].trim().toLowerCase() };
  const t = raw.trim().toLowerCase();
  return { name: null, email: t.includes("@") ? t : null };
}

export function parseAddressList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => parseAddress(s).email)
    .filter((x): x is string => !!x);
}

const RESUME_EXT = /\.(pdf|docx|doc|txt)$/i;

export type ResumeAttachment = {
  attachmentId: string;
  filename: string;
  mimeType: string | null;
  size: number;
};

export function findResumeAttachments(msg: GmailMessage): ResumeAttachment[] {
  const out: ResumeAttachment[] = [];
  const walk = (p?: Part) => {
    if (!p) return;
    if (p.filename && RESUME_EXT.test(p.filename) && p.body?.attachmentId) {
      out.push({
        attachmentId: p.body.attachmentId,
        filename: p.filename,
        mimeType: p.mimeType ?? null,
        size: p.body.size ?? 0,
      });
    }
    for (const c of p.parts ?? []) walk(c);
  };
  walk(msg.payload);
  return out;
}

export async function getAttachmentBytes(
  accessToken: string,
  messageId: string,
  attachmentId: string,
): Promise<Uint8Array> {
  const json = await gget<{ data?: string; size?: number }>(
    accessToken,
    `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
  );
  const b64 = (json.data ?? "").replace(/-/g, "+").replace(/_/g, "/");
  return new Uint8Array(Buffer.from(b64, "base64"));
}