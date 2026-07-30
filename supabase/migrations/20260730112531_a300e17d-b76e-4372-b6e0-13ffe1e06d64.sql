ALTER TABLE public.email_candidates ADD COLUMN IF NOT EXISTS artifact_type text;
ALTER TABLE public.email_import_skips ADD COLUMN IF NOT EXISTS artifact_type text;
CREATE INDEX IF NOT EXISTS email_import_skips_user_artifact_idx ON public.email_import_skips (user_id, artifact_type);