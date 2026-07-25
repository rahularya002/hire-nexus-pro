-- ============ email_import_runs ============
CREATE TABLE public.email_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  google_email text,
  status text NOT NULL DEFAULT 'running',
  date_from timestamptz,
  date_to timestamptz,
  labels text[] NOT NULL DEFAULT '{}',
  exclusions text[] NOT NULL DEFAULT '{}',
  page_token text,
  emails_scanned integer NOT NULL DEFAULT 0,
  resume_emails integer NOT NULL DEFAULT 0,
  people_found integer NOT NULL DEFAULT 0,
  people_enriched integer NOT NULL DEFAULT 0,
  duplicates_merged integer NOT NULL DEFAULT 0,
  failures integer NOT NULL DEFAULT 0,
  failure_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_import_runs TO authenticated;
GRANT ALL ON public.email_import_runs TO service_role;
ALTER TABLE public.email_import_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency members read import runs" ON public.email_import_runs
  FOR SELECT TO authenticated USING (public.is_agency_member(agency_id));
CREATE POLICY "Owner inserts import runs" ON public.email_import_runs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_agency_member(agency_id));
CREATE POLICY "Owner updates import runs" ON public.email_import_runs
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owner or admin deletes import runs" ON public.email_import_runs
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_agency_admin(agency_id, auth.uid()));

CREATE TRIGGER set_email_import_runs_updated_at BEFORE UPDATE ON public.email_import_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX email_import_runs_agency_idx ON public.email_import_runs (agency_id, created_at DESC);

-- ============ email_candidates ============
CREATE TABLE public.email_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Unknown',
  email text,
  phone text,
  phone_digits text,
  location text,
  role text,
  current_company text,
  experience text,
  skills text[] NOT NULL DEFAULT '{}',
  salary_min numeric,
  salary_max numeric,
  notes text,
  resume_count integer NOT NULL DEFAULT 0,
  email_count integer NOT NULL DEFAULT 0,
  first_email_at timestamptz,
  last_email_at timestamptz,
  companies_mentioned text[] NOT NULL DEFAULT '{}',
  search_blob text NOT NULL DEFAULT '',
  promoted_candidate_id uuid REFERENCES public.candidates(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_candidates TO authenticated;
GRANT ALL ON public.email_candidates TO service_role;
ALTER TABLE public.email_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency members read email candidates" ON public.email_candidates
  FOR SELECT TO authenticated USING (public.is_agency_member(agency_id));
CREATE POLICY "Owner inserts email candidates" ON public.email_candidates
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_agency_member(agency_id));
CREATE POLICY "Agency members update email candidates" ON public.email_candidates
  FOR UPDATE TO authenticated USING (public.is_agency_member(agency_id)) WITH CHECK (public.is_agency_member(agency_id));
CREATE POLICY "Owner or admin deletes email candidates" ON public.email_candidates
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_agency_admin(agency_id, auth.uid()));

CREATE TRIGGER set_email_candidates_updated_at BEFORE UPDATE ON public.email_candidates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX email_candidates_user_email_idx ON public.email_candidates (user_id, lower(email)) WHERE email IS NOT NULL;
CREATE INDEX email_candidates_user_phone_idx ON public.email_candidates (user_id, phone_digits) WHERE phone_digits IS NOT NULL;
CREATE INDEX email_candidates_agency_idx ON public.email_candidates (agency_id, last_email_at DESC);
CREATE INDEX email_candidates_search_idx ON public.email_candidates USING gin (to_tsvector('english', search_blob));
CREATE INDEX email_candidates_skills_idx ON public.email_candidates USING gin (skills);

-- ============ email_messages ============
CREATE TABLE public.email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  email_candidate_id uuid REFERENCES public.email_candidates(id) ON DELETE CASCADE,
  gmail_message_id text NOT NULL,
  gmail_thread_id text,
  subject text,
  snippet text,
  from_email text,
  from_name text,
  to_emails text[] NOT NULL DEFAULT '{}',
  direction text NOT NULL DEFAULT 'inbound',
  has_resume boolean NOT NULL DEFAULT false,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_messages TO authenticated;
GRANT ALL ON public.email_messages TO service_role;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency members read email messages" ON public.email_messages
  FOR SELECT TO authenticated USING (public.is_agency_member(agency_id));
CREATE POLICY "Owner inserts email messages" ON public.email_messages
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_agency_member(agency_id));
CREATE POLICY "Owner updates email messages" ON public.email_messages
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owner or admin deletes email messages" ON public.email_messages
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_agency_admin(agency_id, auth.uid()));

CREATE UNIQUE INDEX email_messages_user_msg_idx ON public.email_messages (user_id, gmail_message_id);
CREATE INDEX email_messages_person_idx ON public.email_messages (email_candidate_id, sent_at DESC);
CREATE INDEX email_messages_subject_search_idx ON public.email_messages USING gin (to_tsvector('english', coalesce(subject,'') || ' ' || coalesce(snippet,'')));

-- ============ email_resume_versions ============
CREATE TABLE public.email_resume_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  email_candidate_id uuid NOT NULL REFERENCES public.email_candidates(id) ON DELETE CASCADE,
  email_message_id uuid REFERENCES public.email_messages(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime text,
  size_bytes integer,
  extracted_text text,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_resume_versions TO authenticated;
GRANT ALL ON public.email_resume_versions TO service_role;
ALTER TABLE public.email_resume_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency members read resume versions" ON public.email_resume_versions
  FOR SELECT TO authenticated USING (public.is_agency_member(agency_id));
CREATE POLICY "Owner inserts resume versions" ON public.email_resume_versions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_agency_member(agency_id));
CREATE POLICY "Owner updates resume versions" ON public.email_resume_versions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owner or admin deletes resume versions" ON public.email_resume_versions
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_agency_admin(agency_id, auth.uid()));

CREATE INDEX email_resume_versions_person_idx ON public.email_resume_versions (email_candidate_id, received_at DESC);
CREATE INDEX email_resume_versions_text_idx ON public.email_resume_versions USING gin (to_tsvector('english', coalesce(extracted_text,'')));