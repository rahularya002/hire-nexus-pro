// Server-only CV text extraction. Imported dynamically from server-function handlers.

export async function extractCvText(bytes: Uint8Array, fileName: string, mime: string | null): Promise<string> {
  const name = fileName.toLowerCase();
  const isPdf = name.endsWith(".pdf") || mime === "application/pdf";
  const isDocx = name.endsWith(".docx") || mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const isDoc = name.endsWith(".doc") && !isDocx;
  const isTxt = name.endsWith(".txt") || mime === "text/plain";

  if (isPdf) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return (Array.isArray(text) ? text.join("\n") : text) ?? "";
  }

  if (isDocx) {
    const mammoth = await import("mammoth");
    const buf = Buffer.from(bytes);
    const res = await mammoth.extractRawText({ buffer: buf });
    return res.value ?? "";
  }

  if (isDoc) {
    throw new Error("Legacy .doc files are not supported. Please convert to .docx or PDF.");
  }

  if (isTxt) {
    return new TextDecoder("utf-8").decode(bytes);
  }

  throw new Error("Unsupported file type. Use PDF, DOCX or TXT.");
}