// Race-safe promotion of an archive person into the permanent candidate table.
// `email_candidates.promoted_candidate_id` is the lock: whoever claims it first
// owns the candidate row, so double clicks can never create two candidates.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
  const email = ((person.email as string | null) ?? "").trim().toLowerCase() || null;

  const findByEmail = async () => {
    if (!email) return null;
    const { data } = await supabaseAdmin
      .from("candidates")
      .select("id,agency_id")
      .ilike("email", email)
      .limit(2);
    const rows = (data ?? []) as { id: string; agency_id: string }[];
    return rows.find((r) => r.agency_id === agencyId) ?? rows[0] ?? null;
  };

  let candidateId: string | null = null;
  let alreadyExisted = false;
  let createdByUs = false;

  const match = await findByEmail();
  if (match) {
    candidateId = match.id;
    alreadyExisted = true;
  } else {
    const { data: latest } = await supabaseAdmin
      .from("email_resume_versions")
      .select("storage_path")
      .eq("email_candidate_id", personId)
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const insert = async (withEmail: boolean) =>
      supabaseAdmin
        .from("candidates")
        .insert({
          agency_id: agencyId,
          name: (person.name as string) || (email ?? "Unknown candidate"),
          email: withEmail ? email : null,
          phone: (person.phone as string | null) ?? null,
          role: (person.role as string | null) ?? null,
          experience: (person.experience as string | null) ?? null,
          location: (person.location as string | null) ?? null,
          current_company: (person.current_company as string | null) ?? null,
          skills: (person.skills as string[] | null) ?? [],
          salary_min: (person.salary_min as number | null) ?? null,
          salary_max: (person.salary_max as number | null) ?? null,
          notes: withEmail
            ? ((person.notes as string | null) ?? null)
            : [person.notes as string | null, email ? `Email: ${email}` : null].filter(Boolean).join("\n") || null,
          resume_url: (latest?.storage_path as string | undefined) ?? null,
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
        if (dup && dup.agency_id === agencyId) {
          candidateId = dup.id;
          alreadyExisted = true;
        } else {
          const retry = await insert(false);
          if (retry.error) throw new Error(retry.error.message);
          candidateId = retry.data!.id as string;
          createdByUs = true;
        }
      } else {
        throw new Error(first.error.message);
      }
    } else {
      candidateId = first.data!.id as string;
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
      if (createdByUs) await supabaseAdmin.from("candidates").delete().eq("id", candidateId!);
      return { candidateId: winnerId, alreadyExisted: true };
    }
  }

  return { candidateId: candidateId!, alreadyExisted };
}
