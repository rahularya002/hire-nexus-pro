import { supabase } from "@/integrations/supabase/client";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXT = /\.(pdf|docx?|txt)$/i;

/**
 * Upload a CV file to the private `documents` bucket.
 * Returns the storage path (to be stored in candidates.resume_url) plus mime/size.
 * Access is granted via getResumeSignedUrl().
 */
export async function uploadCvFile(file: File): Promise<{ path: string; name: string; mime: string; size: number }> {
  if (!ALLOWED_EXT.test(file.name)) {
    throw new Error("Unsupported file. Use PDF, DOC, DOCX or TXT.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 10 MB.`);
  }
  const { data: sess } = await supabase.auth.getUser();
  const uid = sess.user?.id ?? "anon";
  const safe = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `candidates/${uid}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage
    .from("documents")
    .upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw new Error(error.message);
  return { path, name: file.name, mime: file.type || "application/octet-stream", size: file.size };
}