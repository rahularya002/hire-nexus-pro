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
    // unpdf's plain extractText joins everything with spaces, destroying the
    // line structure a resume header depends on ("PREM LATA CHAUHAN" then the
    // contact block). Rebuild lines from pdf.js text items by their y position
    // so downstream identity extraction sees real header lines.
    const laid = await pdfLines(pdf);
    if (laid.trim().length > 40) return laid.slice(0, MAX_TEXT_CHARS);
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
type TextItem = { str?: string; transform?: number[]; hasEOL?: boolean };

/** Reconstruct visual lines from a PDF's positioned text items. */
async function pdfLines(pdf: {
  numPages: number;
  getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: unknown[] }> }>;
}): Promise<string> {
  const out: string[] = [];
  const pages = Math.min(pdf.numPages, 20);
  for (let p = 1; p <= pages; p++) {
    let items: TextItem[] = [];
    try {
      const page = await pdf.getPage(p);
      items = (await page.getTextContent()).items as TextItem[];
    } catch {
      continue;
    }
    // Group by rounded baseline y, then order left-to-right within the line.
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const it of items) {
      const s = it.str ?? "";
      if (!s.trim()) continue;
      const y = Math.round((it.transform?.[5] ?? 0) * 2) / 2;
      const x = it.transform?.[4] ?? 0;
      const row = rows.get(y) ?? [];
      row.push({ x, s });
      rows.set(y, row);
    }
    for (const y of [...rows.keys()].sort((a, b) => b - a)) {
      const line = (rows.get(y) ?? [])
        .sort((a, b) => a.x - b.x)
        .map((c) => c.s)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (line) out.push(line);
    }
    out.push("");
  }
  return out.join("\n");
}
