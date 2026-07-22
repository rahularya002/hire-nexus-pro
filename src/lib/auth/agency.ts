// Resolve the caller's agency_id from agency_members.
// Cached briefly in-memory to avoid re-querying on every activity insert.
const cache = new Map<string, { id: string | null; at: number }>();
const TTL_MS = 60_000;

export async function getUserAgencyId(
  supabase: any,
  userId: string,
): Promise<string | null> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.id;
  const { data } = await supabase
    .from("agency_members")
    .select("agency_id")
    .eq("user_id", userId)
    .maybeSingle();
  const id = (data?.agency_id as string | undefined) ?? null;
  cache.set(userId, { id, at: Date.now() });
  return id;
}