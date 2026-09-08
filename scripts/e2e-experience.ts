// Read-only REAL check on stored resume text: confirms a "Work Experience"
// section with employment date ranges never becomes a bogus duration
// (e.g. "20 years" out of "2019 - 2023"). Masked output, no writes.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { extractScopedFields } from "@/lib/candidate-fields";

const LIMIT = Number(process.env.E2E_RESUMES ?? 200);

const scrub = (s: string) =>
  s
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "<email>")
    .replace(/(?:\+?\d[\d\s.-]{7,}\d)/g, "<phone>")
    .replace(/\s+/g, " ")
    .trim();

const { data, error } = await supabaseAdmin
  .from("email_resume_versions")
  .select("id, file_name, extracted_text")
  .not("extracted_text", "is", null)
  .limit(LIMIT);
if (error) throw new Error(error.message);

const rows = (data ?? []).filter((r) => (r.extracted_text as string).trim().length > 200);
console.log("stored resumes with text:", rows.length, "\n");

let withHeading = 0;
let withRange = 0;
let bogus = 0;
let labelled = 0;
let reported = 0;
const bogusSamples: string[] = [];

for (const r of rows) {
  const docText = r.extracted_text as string;
  const flat = docText.replace(/\s+/g, " ");
  const heading = /\b(work|professional|employment)\s+experience\b/i.exec(flat)?.[0] ?? null;
  const range =
    /\b(19|20)\d{2}\s*(?:-|–|—|to)\s*((19|20)\d{2}|present|current|till\s*date)/i.exec(flat)?.[0] ?? null;
  const label = /\b(?:total\s*(?:work\s*)?experience|overall\s*experience|years?\s*of\s*experience|experience|exp)\b[^\n]{0,40}/i.exec(
    docText,
  )?.[0];

  const f = extractScopedFields({ docText, bodyText: "", bodyTrusted: false });
  const value = f.experience.value;
  const numeric = value ? parseInt(value, 10) : null;
  const labelHasNumber = /\d/.test(label ?? "");
  const isBogus = !!numeric && (numeric === 19 || numeric === 20) && !labelHasNumber;

  if (heading) withHeading++;
  if (range) withRange++;
  if (labelHasNumber) labelled++;
  if (value) reported++;
  if (isBogus) {
    bogus++;
    bogusSamples.push(`${r.file_name}: value=${value} range=${range} label=${scrub(label ?? "")}`);
  }

  if (heading && range) {
    console.log(`${r.file_name}`);
    console.log("  heading:", heading, "| range:", range, "| labelled exp:", label ? scrub(label) : "none");
    console.log(
      "  EXTRACTED experience:",
      value ?? "null",
      "| provenance:",
      f.experience.provenance ?? "-",
      isBogus ? "<< BOGUS" : "",
    );
  }
}

console.log("\n=== SUMMARY ===");
console.log("resumes examined:", rows.length);
console.log("with work-experience heading:", withHeading, "| with employment date range:", withRange);
console.log("with explicit labelled duration:", labelled, "| experience reported:", reported);
console.log("bogus 19/20-year values:", bogus);
for (const s of bogusSamples.slice(0, 10)) console.log("  ", s);
console.log(bogus === 0 ? "PASS: no calendar year reported as experience" : "FAIL");
