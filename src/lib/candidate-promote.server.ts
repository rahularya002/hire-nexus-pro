// Race-safe promotion of an archive person into the permanent candidate table.
// `email_candidates.promoted_candidate_id` is the lock: whoever claims it first
// owns the candidate row, so double clicks can never create two candidates.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sanitizeCandidateIdentity } from "./candidate-identity";
import { cleanBodyText, extractDeterministic } from "./pipeline/normalize.server";

export async function linkOrCreateCandidate(
  personId: string,
  userId: string,
): Promise<{ candidateId: string; alreadyExisted: boolean }> {
  const { data: person } = await supabaseAdmin
    .from("email_candidates")
    .select("*")
    .eq("id", personId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!person) throw new Error("Saved person not found");

  const already = (person.promoted_candidate_id as string | null) ?? null;
  if (already) return { candidateId: already, alreadyExisted: true };

  const agencyId = person.agency_id as string;

  const [{ data: latestMessage }, { data: latestResume }] = await Promise.all([
    supabaseAdmin
      .from("email_messages")
      .select("subject,snippet,from_email,from_name")
      .eq("email_candidate_id", personId)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("email_resume_versions")
      .select("file_name,storage_path,extracted_text")
      .eq("email_candidate_id", personId)
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const bodyText = cleanBodyText(`${latestMessage?.subject ?? ""}\n${latestMessage?.snippet ?? ""}`);
  const docText = (latestResume?.extracted_text as string | null) ?? "";
  const deterministic = extractDeterministic({
    fromEmail: (latestMessage?.from_email as string | null) ?? null,
    fromName: (latestMessage?.from_name as string | null) ?? null,
    cleanBody: bodyText,
    docText,
    primaryFileName: (latestResume?.file_name as string | null) ?? null,
  }).fields;
  const safeStoredIdentity = sanitizeCandidateIdentity(
    { name: person.name as string | null, email: person.email as string | null, phone: person.phone as string | null },
    {
      fromEmail: (latestMessage?.from_email as string | null) ?? null,
      fromName: (latestMessage?.from_name as string | null) ?? null,
      bodyText,
      docText,
      hasAttachment: !!latestResume,
    },
  );
  const safeName = deterministic.name ?? safeStoredIdentity.name ?? deterministic.email ?? safeStoredIdentity.email ?? "Unknown candidate";
  const email = ((deterministic.email ?? safeStoredIdentity.email) ?? "").trim().toLowerCase() || null;
  const phone = deterministic.phone ?? safeStoredIdentity.phone ?? null;
  const phoneDigits = (phone ?? "").replace(/\D+/g, "");
  const phoneTail = phoneDigits.length >= 8 ? phoneDigits.slice(-10) : null;

  // Only ever link to a candidate inside the promoting user's own agency —
  // the admin client bypasses RLS, so a same-email row from another tenant must
  // never be reused.
  const findByEmail = async () => {
    if (!email) return null;
    const { data } = await supabaseAdmin
      .from("candidates")
      .select("id,agency_id")
      .eq("agency_id", agencyId)
      .ilike("email", email)
      .limit(1);
    return ((data ?? []) as { id: string; agency_id: string }[])[0] ?? null;
  };

  /**
   * Email is the strongest identity, but a forwarded CV often has only a phone
   * number. Matching the last 10 digits inside the same agency prevents a second
   * row for a person who is already in the grid.
   */
  const findByPhone = async () => {
    if (!phoneTail) return null;
    const { data } = await supabaseAdmin
      .from("candidates")
      .select("id,agency_id")
      .eq("agency_id", agencyId)
      .ilike("phone", `%${phoneTail}%`)
      .limit(1);
    return ((data ?? []) as { id: string; agency_id: string }[])[0] ?? null;
  };

  let candidateId: string | null = null;
  let alreadyExisted = false;
  let createdByUs = false;

  const match = (await findByEmail()) ?? (await findByPhone());

  if (match) {
    candidateId = match.id;
    alreadyExisted = true;
  } else {
    const insert = async (withEmail: boolean) =>
      supabaseAdmin
        .from("candidates")
        .insert({
          agency_id: agencyId,
          name: safeName,
          email: withEmail ? email : null,
          phone,
          role: deterministic.role ?? (person.role as string | null) ?? null,
          experience: deterministic.experience ?? (person.experience as string | null) ?? null,
          location: deterministic.location ?? (person.location as string | null) ?? null,
          current_company: deterministic.current_company ?? (person.current_company as string | null) ?? null,
          skills: Array.from(new Set([...(deterministic.skills ?? []), ...((person.skills as string[] | null) ?? [])])).slice(0, 30),
          salary_min: deterministic.salary_min ?? (person.salary_min as number | null) ?? null,
          salary_max: deterministic.salary_max ?? (person.salary_max as number | null) ?? null,
          notes: withEmail
            ? ((person.notes as string | null) ?? null)
            : [person.notes as string | null, email ? `Email: ${email}` : null].filter(Boolean).join("\n") || null,
          resume_url: (latestResume?.storage_path as string | undefined) ?? null,
          source: "inbound",
          created_by: userId,
        })
        .select("id")
        .single();

    const first = await insert(true);
    if (first.error) {
      // Unique email collision: reuse the existing row when it is ours, otherwise
      // keep the person without the duplicate email so nothing is lost.
      if (first.error.code === "23505") {
        const dup = await findByEmail();
        if (dup) {
          candidateId = dup.id;
          alreadyExisted = true;
        } else {
          const retry = await insert(false);
          if (retry.error) throw new Error(retry.error.message);
          const retryId = retry.data?.id as string | undefined;
          if (!retryId) throw new Error("Candidate could not be created");
          candidateId = retryId;
          createdByUs = true;
        }
      } else {
        throw new Error(first.error.message);
      }
    } else {
      const firstId = first.data?.id as string | undefined;
      if (!firstId) throw new Error("Candidate could not be created");
      candidateId = firstId;
      createdByUs = true;
    }
  }

  // Claim the person. Only one concurrent request wins the conditional update.
  const { data: claimed } = await supabaseAdmin
    .from("email_candidates")
    .update({ promoted_candidate_id: candidateId })
    .eq("id", personId)
    .is("promoted_candidate_id", null)
    .select("id");

  if (!claimed?.length) {
    // Someone else promoted this person first — drop the row we just created.
    const { data: winner } = await supabaseAdmin
      .from("email_candidates")
      .select("promoted_candidate_id")
      .eq("id", personId)
      .maybeSingle();
    const winnerId = (winner?.promoted_candidate_id as string | null) ?? null;
    if (winnerId && winnerId !== candidateId) {
          if (createdByUs && candidateId) await supabaseAdmin.from("candidates").delete().eq("id", candidateId);
      return { candidateId: winnerId, alreadyExisted: true };
    }
  }

  if (!candidateId) throw new Error("Candidate could not be promoted");
  return { candidateId, alreadyExisted };
}
