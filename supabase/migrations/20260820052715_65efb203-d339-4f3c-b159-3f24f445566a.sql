CREATE TABLE public.email_searches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  raw_query text NOT NULL,
  plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  gmail_queries text[] NOT NULL DEFAULT '{}',
  query_index integer NOT NULL DEFAULT 0,
  page_token text,
  listed_count integer NOT NULL DEFAULT 0,
  hydrated_count integer NOT NULL DEFAULT 0,
  hit_count integer NOT NULL DEFAULT 0,
  ai_calls integer NOT NULL DEFAULT 0,
  cache_hits integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_searches TO authenticated;
GRANT ALL ON public.email_searches TO service_role;
ALTER TABLE public.email_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads email searches" ON public.email_searches
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Owner inserts email searches" ON public.email_searches
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_agency_member(agency_id));
CREATE POLICY "Owner updates email searches" ON public.email_searches
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owner or admin deletes email searches" ON public.email_searches
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_agency_admin(agency_id, auth.uid()));

CREATE TRIGGER email_searches_set_updated_at BEFORE UPDATE ON public.email_searches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX email_searches_user_created_idx ON public.email_searches (user_id, created_at DESC);

CREATE TABLE public.email_search_hits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  search_id uuid NOT NULL REFERENCES public.email_searches(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  gmail_message_id text NOT NULL,
  gmail_thread_id text,
  subject text,
  snippet text,
  from_email text,
  from_name text,
  sent_at timestamptz,
  score integer NOT NULL DEFAULT 0,
  score_parts jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence integer NOT NULL DEFAULT 0,
  artifact_type text,
  reason text,
  extracted jsonb NOT NULL DEFAULT '{}'::jsonb,
  pending_payload jsonb,
  resume_storage_path text,
  resume_file_name text,
  origin text NOT NULL DEFAULT 'gmail',
  email_candidate_id uuid REFERENCES public.email_candidates(id) ON DELETE SET NULL,
  saved_email_candidate_id uuid REFERENCES public.email_candidates(id) ON DELETE SET NULL,
  saved_candidate_id uuid REFERENCES public.candidates(id) ON DELETE SET NULL,
  dismissed_at timestamptz,
  saved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (search_id, gmail_message_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_search_hits TO authenticated;
GRANT ALL ON public.email_search_hits TO service_role;
ALTER TABLE public.email_search_hits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads search hits" ON public.email_search_hits
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Owner inserts search hits" ON public.email_search_hits
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_agency_member(agency_id));
CREATE POLICY "Owner updates search hits" ON public.email_search_hits
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owner or admin deletes search hits" ON public.email_search_hits
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_agency_admin(agency_id, auth.uid()));

CREATE INDEX email_search_hits_search_score_idx ON public.email_search_hits (search_id, score DESC);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS email_candidates_search_blob_trgm_idx
  ON public.email_candidates USING gin (search_blob gin_trgm_ops);