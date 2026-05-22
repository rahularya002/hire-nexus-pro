
-- Enums
CREATE TYPE public.interview_status AS ENUM (
  'pending_confirmation','confirmed','reschedule_requested','completed','no_show','cancelled'
);

CREATE TYPE public.interview_provider AS ENUM (
  'google_meet','microsoft_teams','zoom','on_site','phone'
);

CREATE TYPE public.interview_kind AS ENUM (
  'hr_screen','technical','hiring_manager','panel','ceo','culture_fit','case_study'
);

CREATE TYPE public.invoice_status AS ENUM ('draft','sent','paid','overdue');

-- Interviews
CREATE TABLE public.interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  position_id uuid NOT NULL,
  round_index integer NOT NULL DEFAULT 1,
  kind public.interview_kind NOT NULL DEFAULT 'hr_screen',
  interviewer text,
  scheduled_at timestamptz,
  duration_minutes integer DEFAULT 60,
  status public.interview_status NOT NULL DEFAULT 'pending_confirmation',
  provider public.interview_provider NOT NULL DEFAULT 'google_meet',
  meeting_link text,
  location text,
  notes text,
  cv_attached boolean NOT NULL DEFAULT true,
  recruiter_reminder boolean NOT NULL DEFAULT false,
  candidate_reminder boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_interviews_application ON public.interviews(application_id);
CREATE INDEX idx_interviews_position ON public.interviews(position_id);
CREATE INDEX idx_interviews_candidate ON public.interviews(candidate_id);
CREATE INDEX idx_interviews_scheduled ON public.interviews(scheduled_at);

ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view interviews" ON public.interviews FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter')
  OR has_role(auth.uid(),'senior_recruiter') OR has_role(auth.uid(),'recruiter')
);

CREATE POLICY "Staff insert interviews" ON public.interviews FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter')
  OR has_role(auth.uid(),'senior_recruiter') OR has_role(auth.uid(),'recruiter')
);

CREATE POLICY "Staff update interviews" ON public.interviews FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter')
  OR has_role(auth.uid(),'senior_recruiter') OR has_role(auth.uid(),'recruiter')
);

CREATE POLICY "Admins leads delete interviews" ON public.interviews FOR DELETE TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter'));

CREATE POLICY "Clients view own interviews" ON public.interviews FOR SELECT TO authenticated
USING (is_client_owner_of_position(position_id, auth.uid()));

CREATE TRIGGER trg_interviews_updated_at BEFORE UPDATE ON public.interviews
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Placements
CREATE TABLE public.placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  position_id uuid NOT NULL,
  client_id uuid NOT NULL,
  ctc_inr numeric(14,2),
  ctc_display text,
  offer_date date,
  joining_date date,
  guarantee_window_days integer NOT NULL DEFAULT 90,
  invoice_status public.invoice_status NOT NULL DEFAULT 'draft',
  invoice_amount_inr numeric(14,2),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_placements_position ON public.placements(position_id);
CREATE INDEX idx_placements_client ON public.placements(client_id);
CREATE INDEX idx_placements_candidate ON public.placements(candidate_id);

ALTER TABLE public.placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view placements" ON public.placements FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter')
  OR has_role(auth.uid(),'senior_recruiter') OR has_role(auth.uid(),'recruiter')
);

CREATE POLICY "Staff insert placements" ON public.placements FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter')
  OR has_role(auth.uid(),'senior_recruiter') OR has_role(auth.uid(),'recruiter')
);

CREATE POLICY "Staff update placements" ON public.placements FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter')
  OR has_role(auth.uid(),'senior_recruiter') OR has_role(auth.uid(),'recruiter')
);

CREATE POLICY "Admins leads delete placements" ON public.placements FOR DELETE TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter'));

CREATE POLICY "Clients view own placements" ON public.placements FOR SELECT TO authenticated
USING (is_client_owner_of_position(position_id, auth.uid()));

CREATE TRIGGER trg_placements_updated_at BEFORE UPDATE ON public.placements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
