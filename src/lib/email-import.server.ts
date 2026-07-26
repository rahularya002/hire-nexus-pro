// Server-only Gmail → Email Archive processing. Never imported from route/component code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildQuery,
  findResumeAttachments,
  getAttachmentBytes,
  getMessage,
  header,
  listMessageIds,
  messageLooksLikeResumeEmail,
  parseAddress,
  parseAddressList,
  preferResumeAttachments,
  textLooksLikeResume,
} from "./gmail.server";

export type Extracted = {
  is_resume?: boolean | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  current_company?: string | null;
  experience?: string | null;
  location?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  skills?: string[] | null;
  notes?: string | null;
};

/** AI models happily return the string "null" — treat that as empty. */
function clean(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || /^(null|undefined|n\/a|na|none|unknown|-)$/i.test(t)) return null;
  return t;
}

export async function aiExtract(rawText: string): Promise<Extracted> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey || rawText.trim().length < 40) return {};
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You extract recruiter-facing candidate fields from a document. First decide 'is_resume': true ONLY if the document is a person's resume/CV or job-application profile. Set it to false for bank or brokerage statements, invoices, receipts, transaction or market alerts, newsletters, tickets, policies, contracts and any other non-resume document. When is_resume is false, set every other field to null. Otherwise return ONLY via the extract_candidate tool. Use null for missing fields. Keep values short. 'skills' should be 5-20 individual technologies or competencies. 'experience' like '6 years'. Salary min/max in LPA as numbers when stated; null otherwise. 'notes' is a 1-2 sentence recruiter-facing summary.",
          },
          { role: "user", content: rawText.slice(0, 15_000) },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_candidate",
              description: "Return structured candidate fields.",
              parameters: {
                type: "object",
                properties: {
                  is_resume: { type: "boolean" },
                  name: { type: ["string", "null"] },
                  email: { type: ["string", "null"] },
                  phone: { type: ["string", "null"] },
                  role: { type: ["string", "null"] },
                  current_company: { type: ["string", "null"] },
                  experience: { type: ["string", "null"] },
                  location: { type: ["string", "null"] },
                  salary_min: { type: ["number", "null"] },
                  salary_max: { type: ["number", "null"] },
                  skills: { type: ["array", "null"], items: { type: "string" } },
                  notes: { type: ["string", "null"] },
                },
                required: [
                  "is_resume","name","email","phone","role","current_company","experience","location",
                  "salary_min","salary_max","skills","notes",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_candidate" } },
      }),
    });
    if (!res.ok) return {};
    const json = (await res.json()) as {
      choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
    };
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    return args ? (JSON.parse(args) as Extracted) : {};
  } catch {
    return {};
  }
}

function digits(v?: string | null) {
  const d = (v ?? "").replace(/\D+/g, "");
  return d.length >= 8 ? d.slice(-10) : null;
}

function niceName(fileName: string, fallback: string | null) {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  const cleaned = base.replace(/\b(resume|cv|final|updated|new|copy|\d{2,})\b/gi, "").replace(/\s+/g, " ").trim();
  return cleaned.length >= 3 ? cleaned : fallback || "Unknown";
}

type Run = {
  id: string;
  agency_id: string;
  user_id: string;
  google_email: string | null;
  date_from: string | null;
  date_to: string | null;
  labels: string[];
  exclusions: string[];
  page_token: string | null;
  emails_scanned: number;
  resume_emails: number;
  people_found: number;
  people_enriched: number;
  duplicates_merged: number;
  failures: number;
  failure_log: unknown;
};

export type BatchResult = {
  done: boolean;
  scanned: number;
  newPeople: { id: string; name: string; email: string | null }[];
};

/** Process one page of resume-bearing emails for a run. */
export async function processRunBatch(run: Run, accessToken: string, pageSize = 8): Promise<BatchResult> {
  const query = buildQuery({
    dateFrom: run.date_from,
    dateTo: run.date_to,
    labels: run.labels,
    exclusions: run.exclusions,
  });

  const page = await listMessageIds(accessToken, query, run.page_token, pageSize);
  const newPeople: BatchResult["newPeople"] = [];
  const failures: { message: string; subject?: string }[] = [];

  let scanned = 0;
  let resumeEmails = 0;
  let peopleFound = 0;
  let enriched = 0;
  let merged = 0;

  for (const ref of page.messages) {
    scanned++;
    try {
      const { data: dupe } = await supabaseAdmin
        .from("email_messages")
        .select("id")
        .eq("user_id", run.user_id)
        .eq("gmail_message_id", ref.id)
        .maybeSingle();
      if (dupe) continue;

      const msg = await getMessage(accessToken, ref.id);
      const attachments = findResumeAttachments(msg);
      if (attachments.length === 0) continue;
      resumeEmails++;

      const from = parseAddress(header(msg, "From"));
      const toList = parseAddressList(header(msg, "To"));
      const subject = header(msg, "Subject");
      const sentAt = msg.internalDate
        ? new Date(Number(msg.internalDate)).toISOString()
        : header(msg, "Date")
          ? new Date(header(msg, "Date")!).toISOString()
          : null;
      const mine = (run.google_email ?? "").toLowerCase();
      const direction = from.email && mine && from.email === mine ? "outbound" : "inbound";

      // Use the first resume attachment for field extraction.
      const primary = attachments[0];
      const bytes = await getAttachmentBytes(accessToken, ref.id, primary.attachmentId);
      const safe = primary.filename.replace(/[^\w.\-]+/g, "_");
      const storagePath = `email-archive/${run.user_id}/${ref.id}-${safe}`;
      const up = await supabaseAdmin.storage
        .from("documents")
        .upload(storagePath, bytes, { upsert: true, contentType: primary.mimeType ?? undefined });
      if (up.error) throw new Error(up.error.message);

      const { extractCvText } = await import("./cv-parse.server");
      let text = "";
      try {
        text = await extractCvText(bytes, primary.filename, primary.mimeType);
      } catch {
        text = "";
      }
      const ex = await aiExtract(text);

      const email =
        (ex.email ?? "").trim().toLowerCase() ||
        (direction === "inbound" ? from.email : toList[0]) ||
        null;
      const phoneDigits = digits(ex.phone);
      const name = (ex.name ?? "").trim() || from.name || niceName(primary.filename, email);

      // Dedup inside the archive on email or phone.
      type Person = { id: string; skills: string[] | null; resume_count: number; email_count: number };
      let person: Person | null = null;
      if (email) {
        const { data } = await supabaseAdmin
          .from("email_candidates")
          .select("id, skills, resume_count, email_count")
          .eq("user_id", run.user_id)
          .ilike("email", email)
          .maybeSingle();
        person = (data as Person | null) ?? null;
      }
      if (!person && phoneDigits) {
        const { data } = await supabaseAdmin
          .from("email_candidates")
          .select("id, skills, resume_count, email_count")
          .eq("user_id", run.user_id)
          .eq("phone_digits", phoneDigits)
          .maybeSingle();
        person = (data as Person | null) ?? null;
      }

      const skills = (ex.skills ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 30);
      const blob = [name, email, ex.role, ex.current_company, ex.location, skills.join(" "), subject, text.slice(0, 8000)]
        .filter(Boolean)
        .join(" \n ");

      if (person) {
        merged++;
        enriched++;
        const mergedSkills = Array.from(new Set([...(person.skills ?? []), ...skills])).slice(0, 40);
        await supabaseAdmin
          .from("email_candidates")
          .update({
            name,
            email: email ?? undefined,
            phone: ex.phone ?? undefined,
            phone_digits: phoneDigits ?? undefined,
            location: ex.location ?? undefined,
            role: ex.role ?? undefined,
            current_company: ex.current_company ?? undefined,
            experience: ex.experience ?? undefined,
            salary_min: ex.salary_min ?? undefined,
            salary_max: ex.salary_max ?? undefined,
            notes: ex.notes ?? undefined,
            skills: mergedSkills,
            resume_count: (person.resume_count ?? 0) + 1,
            email_count: (person.email_count ?? 0) + 1,
            last_email_at: sentAt,
            search_blob: blob.slice(0, 20_000),
          })
          .eq("id", person.id);
      } else {
        const { data: created, error: cErr } = await supabaseAdmin
          .from("email_candidates")
          .insert({
            agency_id: run.agency_id,
            user_id: run.user_id,
            name,
            email,
            phone: ex.phone ?? null,
            phone_digits: phoneDigits,
            location: ex.location ?? null,
            role: ex.role ?? null,
            current_company: ex.current_company ?? null,
            experience: ex.experience ?? null,
            salary_min: ex.salary_min ?? null,
            salary_max: ex.salary_max ?? null,
            notes: ex.notes ?? null,
            skills,
            resume_count: 1,
            email_count: 1,
            first_email_at: sentAt,
            last_email_at: sentAt,
            search_blob: blob.slice(0, 20_000),
          })
          .select("id, skills, resume_count, email_count")
          .single();
        if (cErr) throw new Error(cErr.message);
        person = created as unknown as Person;
        peopleFound++;
        newPeople.push({ id: person.id, name, email });
      }

      const { data: msgRow, error: mErr } = await supabaseAdmin
        .from("email_messages")
        .insert({
          agency_id: run.agency_id,
          user_id: run.user_id,
          email_candidate_id: person!.id,
          gmail_message_id: ref.id,
          gmail_thread_id: ref.threadId,
          subject,
          snippet: msg.snippet ?? null,
          from_email: from.email,
          from_name: from.name,
          to_emails: toList,
          direction,
          has_resume: true,
          sent_at: sentAt,
        })
        .select("id")
        .single();
      if (mErr) throw new Error(mErr.message);

      for (const att of attachments) {
        const isPrimary = att.attachmentId === primary.attachmentId;
        let path = storagePath;
        if (!isPrimary) {
          const s = att.filename.replace(/[^\w.\-]+/g, "_");
          path = `email-archive/${run.user_id}/${ref.id}-${s}`;
          try {
            const extra = await getAttachmentBytes(accessToken, ref.id, att.attachmentId);
            await supabaseAdmin.storage
              .from("documents")
              .upload(path, extra, { upsert: true, contentType: att.mimeType ?? undefined });
          } catch {
            continue;
          }
        }
        await supabaseAdmin.from("email_resume_versions").insert({
          agency_id: run.agency_id,
          user_id: run.user_id,
          email_candidate_id: person!.id,
          email_message_id: msgRow!.id as string,
          storage_path: path,
          file_name: att.filename,
          mime: att.mimeType,
          size_bytes: att.size,
          extracted_text: isPrimary ? text.slice(0, 200_000) : null,
          received_at: sentAt,
        });
      }
    } catch (e) {
      failures.push({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  const done = !page.nextPageToken;
  const prevLog = Array.isArray(run.failure_log) ? (run.failure_log as { message: string }[]) : [];
  await supabaseAdmin
    .from("email_import_runs")
    .update({
      page_token: page.nextPageToken,
      emails_scanned: run.emails_scanned + scanned,
      resume_emails: run.resume_emails + resumeEmails,
      people_found: run.people_found + peopleFound,
      people_enriched: run.people_enriched + enriched,
      duplicates_merged: run.duplicates_merged + merged,
      failures: run.failures + failures.length,
      failure_log: [...prevLog, ...failures].slice(-50),
      status: done ? "completed" : "running",
      finished_at: done ? new Date().toISOString() : null,
    })
    .eq("id", run.id);

  return { done, scanned, newPeople };
}