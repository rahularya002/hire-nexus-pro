
-- Pipeline stage enum
CREATE TYPE public.application_stage AS ENUM (
  'sourcing',
  'recruiter_shortlist',
  'shared_with_client',
  'client_shortlist',
  'interview_scheduled',
  'rounds',
  'offered',
  'closed'
);

CREATE TYPE public.candidate_source AS ENUM (
  'manual',
  'scout',
  'referral',
  'database',
  'inbound'
);

-- candidates table
CREATE TABLE public.candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE,
  phone text,
  role text,
  experience text,
  location text,
  current_company text,
  skills text[] NOT NULL DEFAULT '{}',
  resume_url text,
  source public.candidate_source NOT NULL DEFAULT 'manual',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_candidates_email ON public.candidates(email);
CREATE INDEX idx_candidates_created_at ON public.candidates(created_at DESC);

CREATE TRIGGER trg_candidates_updated_at
BEFORE UPDATE ON public.candidates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view candidates" ON public.candidates
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'lead_recruiter')
    OR public.has_role(auth.uid(), 'senior_recruiter')
    OR public.has_role(auth.uid(), 'recruiter')
  );

CREATE POLICY "Staff insert candidates" ON public.candidates
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'lead_recruiter')
    OR public.has_role(auth.uid(), 'senior_recruiter')
    OR public.has_role(auth.uid(), 'recruiter')
  );

CREATE POLICY "Staff update candidates" ON public.candidates
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'lead_recruiter')
    OR public.has_role(auth.uid(), 'senior_recruiter')
    OR public.has_role(auth.uid(), 'recruiter')
  );

CREATE POLICY "Admins leads delete candidates" ON public.candidates
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'lead_recruiter')
  );

-- applications table
CREATE TABLE public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  stage public.application_stage NOT NULL DEFAULT 'sourcing',
  match_score integer CHECK (match_score IS NULL OR (match_score >= 0 AND match_score <= 100)),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, position_id)
);

CREATE INDEX idx_applications_position ON public.applications(position_id);
CREATE INDEX idx_applications_candidate ON public.applications(candidate_id);
CREATE INDEX idx_applications_stage ON public.applications(stage);

CREATE TRIGGER trg_applications_updated_at
BEFORE UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- helper: is the current user the client owner of this position?
CREATE OR REPLACE FUNCTION public.is_client_owner_of_position(_position_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.positions p
    JOIN public.clients c ON c.id = p.client_id
    WHERE p.id = _position_id AND c.user_id = _user_id
  );
$$;

-- staff full access
CREATE POLICY "Staff view applications" ON public.applications
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'lead_recruiter')
    OR public.has_role(auth.uid(), 'senior_recruiter')
    OR public.has_role(auth.uid(), 'recruiter')
  );

CREATE POLICY "Staff insert applications" ON public.applications
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'lead_recruiter')
    OR public.has_role(auth.uid(), 'senior_recruiter')
    OR public.has_role(auth.uid(), 'recruiter')
  );

CREATE POLICY "Staff update applications" ON public.applications
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'lead_recruiter')
    OR public.has_role(auth.uid(), 'senior_recruiter')
    OR public.has_role(auth.uid(), 'recruiter')
  );

CREATE POLICY "Admins leads delete applications" ON public.applications
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'lead_recruiter')
  );

-- clients can view their applications once shared
CREATE POLICY "Clients view shared applications" ON public.applications
  FOR SELECT TO authenticated
  USING (
    stage IN (
      'shared_with_client',
      'client_shortlist',
      'interview_scheduled',
      'rounds',
      'offered',
      'closed'
    )
    AND public.is_client_owner_of_position(position_id, auth.uid())
  );

-- clients can view candidates that have a shared application on one of their positions
CREATE POLICY "Clients view shared candidates" ON public.candidates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.applications a
      JOIN public.positions p ON p.id = a.position_id
      JOIN public.clients c ON c.id = p.client_id
      WHERE a.candidate_id = candidates.id
        AND c.user_id = auth.uid()
        AND a.stage IN (
          'shared_with_client',
          'client_shortlist',
          'interview_scheduled',
          'rounds',
          'offered',
          'closed'
        )
    )
  );
