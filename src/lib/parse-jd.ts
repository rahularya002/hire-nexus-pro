// Client-side JD parsing helpers.
// Used by /scout (CV attach) and /client/upload (auto-fill form from JD).

export async function parseJdFile(file: File): Promise<string> {
  const lower = file.name.toLowerCase();
  let text = "";
  if (lower.endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    const parts: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      parts.push(content.items.map((it: any) => ("str" in it ? it.str : "")).join(" "));
    }
    text = parts.join("\n\n");
  } else if (lower.endsWith(".docx")) {
    const mammoth = (await import("mammoth/mammoth.browser" as string)) as {
      extractRawText: (i: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
    };
    const buf = await file.arrayBuffer();
    const res = await mammoth.extractRawText({ arrayBuffer: buf });
    text = res.value;
  } else {
    text = await file.text();
  }
  return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export type ExtractedJdFields = Partial<{
  jobTitle: string;
  location: string;
  experience: string;
  salary: string;
  openings: string;
  skills: string;
}>;

function afterLabel(text: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const re = new RegExp(`(?:^|\\n)\\s*${label}\\s*[:\\-]\\s*([^\\n]+)`, "i");
    const m = text.match(re);
    if (m && m[1]) {
      const v = m[1].trim().replace(/[.;,]+$/, "");
      if (v) return v.slice(0, 200);
    }
  }
  return undefined;
}

export function extractFieldsFromJd(raw: string): ExtractedJdFields {
  const out: ExtractedJdFields = {};
  if (!raw) return out;
  const text = raw.slice(0, 20_000);

  // Job title — labeled, else first non-empty short line
  out.jobTitle = afterLabel(text, ["job\\s*title", "role\\s*title", "position", "role", "designation"]);
  if (!out.jobTitle) {
    const firstLine = text.split(/\n/).map((l) => l.trim()).find((l) => l.length > 2 && l.length < 120);
    if (firstLine && !/^(job\s*description|jd|about)/i.test(firstLine)) out.jobTitle = firstLine;
  }

  out.location = afterLabel(text, ["location", "based\\s*(?:in|at)", "work\\s*location", "city"]);

  // Experience
  out.experience = afterLabel(text, ["experience", "years?\\s*of\\s*experience", "exp"]);
  if (!out.experience) {
    const m = text.match(/(\d{1,2})\s*[-–to]+\s*(\d{1,2})\s*(?:\+?\s*)?(?:yrs?|years?)/i);
    if (m) out.experience = `${m[1]}-${m[2]} years`;
    else {
      const m2 = text.match(/(\d{1,2})\s*\+\s*(?:yrs?|years?)/i);
      if (m2) out.experience = `${m2[1]}+ years`;
    }
  }

  // Salary
  out.salary = afterLabel(text, ["salary", "compensation", "ctc", "package", "pay"]);
  if (!out.salary) {
    const m =
      text.match(/(₹|inr|rs\.?)\s*[\d.,]+\s*(?:[-–to]+\s*[\d.,]+)?\s*(?:lpa|lakhs?|cr|crores?|k)?/i) ||
      text.match(/\$\s*[\d.,]+\s*(?:[-–to]+\s*\$?\s*[\d.,]+)?\s*k?/i);
    if (m) out.salary = m[0].trim().slice(0, 80);
  }

  // Openings
  const openings = afterLabel(text, ["openings?", "vacanc(?:y|ies)", "positions?\\s*available", "no\\.?\\s*of\\s*openings?"]);
  if (openings) {
    const n = openings.match(/\d+/);
    if (n) out.openings = n[0];
  }

  // Skills — labeled line, comma split
  const skillsLine = afterLabel(text, ["skills", "key\\s*skills", "required\\s*skills", "tech\\s*stack", "must\\s*have"]);
  if (skillsLine) {
    const parts = skillsLine
      .split(/[,;|/]| and /i)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2 && s.length <= 40);
    if (parts.length) out.skills = parts.slice(0, 20).join(", ");
  }

  // Strip undefineds
  (Object.keys(out) as (keyof ExtractedJdFields)[]).forEach((k) => {
    if (!out[k]) delete out[k];
  });
  return out;
}