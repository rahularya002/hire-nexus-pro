DO $$ BEGIN
  CREATE TYPE public.candidate_status AS ENUM ('new','contacted','screening','shortlisted','submitted','placed','on_hold','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS current_ctc numeric,
  ADD COLUMN IF NOT EXISTS expected_ctc numeric,
  ADD COLUMN IF NOT EXISTS relevant_experience text,
  ADD COLUMN IF NOT EXISTS previous_companies text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS education text,
  ADD COLUMN IF NOT EXISTS notice_period text,
  ADD COLUMN IF NOT EXISTS availability text,
  ADD COLUMN IF NOT EXISTS last_contacted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS owner_id uuid,
  ADD COLUMN IF NOT EXISTS status public.candidate_status NOT NULL DEFAULT 'new';

CREATE INDEX IF NOT EXISTS candidates_agency_status_idx ON public.candidates (agency_id, status);
CREATE INDEX IF NOT EXISTS candidates_owner_idx ON public.candidates (owner_id);
