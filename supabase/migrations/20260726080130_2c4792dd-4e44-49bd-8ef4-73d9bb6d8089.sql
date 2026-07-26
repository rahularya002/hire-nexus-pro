ALTER TABLE public.email_candidates
  ADD COLUMN IF NOT EXISTS confidence integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'imported',
  ADD COLUMN IF NOT EXISTS email_kind text,
  ADD COLUMN IF NOT EXISTS classification_reason text,
  ADD COLUMN IF NOT EXISTS signals jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS email_candidates_review_status_idx ON public.email_candidates (agency_id, review_status, last_email_at DESC);

ALTER TABLE public.email_import_runs
  ADD COLUMN IF NOT EXISTS needs_review integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skipped_noise integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.email_import_skips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  run_id uuid REFERENCES public.email_import_runs(id) ON DELETE SET NULL,
  gmail_message_id text NOT NULL,
  gmail_thread_id text,
  subject text,
  snippet text,
  from_email text,
  from_name text,
  attachment_names text[] NOT NULL DEFAULT '{}',
  confidence integer NOT NULL DEFAULT 0,
  email_kind text,
  reason text,
  signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  pending_payload jsonb,
  status text NOT NULL DEFAULT 'skipped',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_import_skips TO authenticated;
GRANT ALL ON public.email_import_skips TO service_role;
ALTER TABLE public.email_import_skips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency members read import skips" ON public.email_import_skips
  FOR SELECT TO authenticated USING (public.is_agency_member(agency_id));
CREATE POLICY "Owner inserts import skips" ON public.email_import_skips
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_agency_member(agency_id));
CREATE POLICY "Agency members update import skips" ON public.email_import_skips
  FOR UPDATE TO authenticated USING (public.is_agency_member(agency_id)) WITH CHECK (public.is_agency_member(agency_id));
CREATE POLICY "Owner or admin deletes import skips" ON public.email_import_skips
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_agency_admin(agency_id, auth.uid()));

CREATE TRIGGER set_email_import_skips_updated_at BEFORE UPDATE ON public.email_import_skips
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS email_import_skips_user_msg_idx ON public.email_import_skips (user_id, gmail_message_id);
CREATE INDEX IF NOT EXISTS email_import_skips_status_idx ON public.email_import_skips (agency_id, status, confidence DESC);