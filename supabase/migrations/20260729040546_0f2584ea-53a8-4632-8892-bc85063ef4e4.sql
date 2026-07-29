CREATE TABLE public.ai_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cache_key text NOT NULL,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, cache_key)
);

GRANT SELECT ON public.ai_cache TO authenticated;
GRANT ALL ON public.ai_cache TO service_role;
ALTER TABLE public.ai_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_cache_select_own" ON public.ai_cache
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE INDEX ai_cache_user_kind_idx ON public.ai_cache (user_id, kind);

ALTER TABLE public.email_resume_versions ADD COLUMN IF NOT EXISTS content_sha256 text;
CREATE INDEX IF NOT EXISTS email_resume_versions_hash_idx
  ON public.email_resume_versions (user_id, content_sha256);

ALTER TABLE public.email_candidates ADD COLUMN IF NOT EXISTS ai_summary text;
ALTER TABLE public.email_candidates ADD COLUMN IF NOT EXISTS enriched_at timestamptz;

ALTER TABLE public.email_import_runs ADD COLUMN IF NOT EXISTS ai_calls integer NOT NULL DEFAULT 0;
ALTER TABLE public.email_import_runs ADD COLUMN IF NOT EXISTS cache_hits integer NOT NULL DEFAULT 0;
ALTER TABLE public.email_import_runs ADD COLUMN IF NOT EXISTS auto_imported integer NOT NULL DEFAULT 0;
ALTER TABLE public.email_import_runs ADD COLUMN IF NOT EXISTS tokens_estimated integer NOT NULL DEFAULT 0;