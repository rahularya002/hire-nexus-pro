
-- =========================================================
-- 1. sourced_candidates: cache of profiles from Apify
-- =========================================================
CREATE TABLE public.sourced_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  source_profile_id text NOT NULL,
  name text NOT NULL,
  headline text,
  current_company text,
  location text,
  experience_years numeric,
  skills text[] NOT NULL DEFAULT '{}'::text[],
  email text,
  phone text,
  profile_url text,
  avatar_url text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sourced_candidates_source_profile_unique UNIQUE (source, source_profile_id)
);

CREATE INDEX idx_sourced_candidates_skills ON public.sourced_candidates USING GIN (skills);
CREATE INDEX idx_sourced_candidates_source ON public.sourced_candidates (source);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sourced_candidates TO authenticated;
GRANT ALL ON public.sourced_candidates TO service_role;

ALTER TABLE public.sourced_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view sourced candidates"
  ON public.sourced_candidates FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lead_recruiter'::app_role) OR has_role(auth.uid(), 'senior_recruiter'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role));

CREATE POLICY "Staff insert sourced candidates"
  ON public.sourced_candidates FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lead_recruiter'::app_role) OR has_role(auth.uid(), 'senior_recruiter'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role));

CREATE POLICY "Staff update sourced candidates"
  ON public.sourced_candidates FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lead_recruiter'::app_role) OR has_role(auth.uid(), 'senior_recruiter'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role));

CREATE POLICY "Admins leads delete sourced candidates"
  ON public.sourced_candidates FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lead_recruiter'::app_role));

CREATE TRIGGER set_sourced_candidates_updated_at
  BEFORE UPDATE ON public.sourced_candidates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 2. position_sourcing_runs: one row per Match click
-- =========================================================
CREATE TYPE public.sourcing_run_status AS ENUM ('pending', 'running', 'succeeded', 'failed');

CREATE TABLE public.position_sourcing_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL,
  triggered_by uuid,
  sources text[] NOT NULL DEFAULT '{}'::text[],
  apify_run_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.sourcing_run_status NOT NULL DEFAULT 'pending',
  result_count integer NOT NULL DEFAULT 0,
  cost_credits numeric,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX idx_position_sourcing_runs_position ON public.position_sourcing_runs (position_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.position_sourcing_runs TO authenticated;
GRANT ALL ON public.position_sourcing_runs TO service_role;

ALTER TABLE public.position_sourcing_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view sourcing runs"
  ON public.position_sourcing_runs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lead_recruiter'::app_role) OR has_role(auth.uid(), 'senior_recruiter'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role));

CREATE POLICY "Staff insert sourcing runs"
  ON public.position_sourcing_runs FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lead_recruiter'::app_role) OR has_role(auth.uid(), 'senior_recruiter'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role));

CREATE POLICY "Staff update sourcing runs"
  ON public.position_sourcing_runs FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lead_recruiter'::app_role) OR has_role(auth.uid(), 'senior_recruiter'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role));

CREATE POLICY "Admins leads delete sourcing runs"
  ON public.position_sourcing_runs FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lead_recruiter'::app_role));

-- =========================================================
-- 3. position_sourced_matches: candidate <-> position
-- =========================================================
CREATE TABLE public.position_sourced_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL,
  sourced_candidate_id uuid NOT NULL REFERENCES public.sourced_candidates(id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.position_sourcing_runs(id) ON DELETE SET NULL,
  match_score integer,
  reasoning text,
  rejected boolean NOT NULL DEFAULT false,
  rejected_reason text,
  shortlisted_candidate_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT position_sourced_matches_unique UNIQUE (position_id, sourced_candidate_id)
);

CREATE INDEX idx_position_sourced_matches_position ON public.position_sourced_matches (position_id, match_score DESC NULLS LAST);
CREATE INDEX idx_position_sourced_matches_run ON public.position_sourced_matches (run_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.position_sourced_matches TO authenticated;
GRANT ALL ON public.position_sourced_matches TO service_role;

ALTER TABLE public.position_sourced_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view sourced matches"
  ON public.position_sourced_matches FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lead_recruiter'::app_role) OR has_role(auth.uid(), 'senior_recruiter'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role));

CREATE POLICY "Staff insert sourced matches"
  ON public.position_sourced_matches FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lead_recruiter'::app_role) OR has_role(auth.uid(), 'senior_recruiter'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role));

CREATE POLICY "Staff update sourced matches"
  ON public.position_sourced_matches FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lead_recruiter'::app_role) OR has_role(auth.uid(), 'senior_recruiter'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role));

CREATE POLICY "Admins leads delete sourced matches"
  ON public.position_sourced_matches FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lead_recruiter'::app_role));

CREATE TRIGGER set_position_sourced_matches_updated_at
  BEFORE UPDATE ON public.position_sourced_matches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
