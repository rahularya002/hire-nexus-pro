// Server-only CV text extraction. Imported dynamically from server-function handlers.

// Cloudflare Workers cap memory per request; large PDFs/DOCX blow the limit
// during parsing, which kills the whole request with no response.
const MAX_CV_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_TEXT_CHARS = 200_000;

export async function extractCvText(bytes: Uint8Array, fileName: string, mime: string | null): Promise<string> {
  if (bytes.byteLength > MAX_CV_BYTES) {
    throw new Error("This file is too large to read (max 8 MB). Please upload a smaller PDF or DOCX.");
  }
  const name = fileName.toLowerCase();
  const isPdf = name.endsWith(".pdf") || mime === "application/pdf";
  const isDocx = name.endsWith(".docx") || mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const isDoc = name.endsWith(".doc") && !isDocx;
  const isTxt = name.endsWith(".txt") || mime === "text/plain";

  if (isPdf) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return ((Array.isArray(text) ? text.join("\n") : text) ?? "").slice(0, MAX_TEXT_CHARS);
  }

  if (isDocx) {
    const mammoth = await import("mammoth");
    const buf = Buffer.from(bytes);
    const res = await mammoth.extractRawText({ buffer: buf });
    return (res.value ?? "").slice(0, MAX_TEXT_CHARS);
  }

  if (isDoc) {
    throw new Error("Legacy .doc files are not supported. Please convert to .docx or PDF.");
  }

  if (isTxt) {
    return new TextDecoder("utf-8").decode(bytes).slice(0, MAX_TEXT_CHARS);
  }

  throw new Error("Unsupported file type. Use PDF, DOCX or TXT.");
}