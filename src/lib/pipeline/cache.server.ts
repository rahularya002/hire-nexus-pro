// Two-level AI result cache: resume-bytes keyed and prompt keyed.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CACHE_TTL_DAYS } from "./config";
import { sha256Text } from "./normalize.server";

export type CacheKind = "resume" | "email";

export async function readCache<T>(userId: string, key: string): Promise<T | null> {
  const { data } = await supabaseAdmin
    .from("ai_cache")
    .select("payload, created_at")
    .eq("user_id", userId)
    .eq("cache_key", key)
    .maybeSingle();
  if (!data) return null;
  const age = Date.now() - new Date(data.created_at as string).getTime();
  if (age > CACHE_TTL_DAYS * 86_400_000) return null;
  return (data.payload ?? null) as T | null;
}

export async function writeCache(userId: string, key: string, kind: CacheKind, payload: unknown) {
  await supabaseAdmin
    .from("ai_cache")
    .upsert(
      { user_id: userId, cache_key: key, kind, payload: payload as never, created_at: new Date().toISOString() },
      { onConflict: "user_id,cache_key" },
    );
}

/** Key for the exact prompt we would send: same inputs ⇒ same verdict. */
export function emailCacheKey(parts: {
  fromEmail: string | null;
  subject: string | null;
  attachmentHashes: string[];
  cleanBody: string;
}) {
  return sha256Text(
    [
      (parts.fromEmail ?? "").toLowerCase(),
      (parts.subject ?? "").trim().toLowerCase(),
      [...parts.attachmentHashes].sort().join(","),
      parts.cleanBody.slice(0, 800),
    ].join("|"),
  );
}

/** Key for a resume's raw bytes — hits skip parsing and classification alike. */
export function resumeCacheKey(sha256: string) {
  return `resume:${sha256}`;
}