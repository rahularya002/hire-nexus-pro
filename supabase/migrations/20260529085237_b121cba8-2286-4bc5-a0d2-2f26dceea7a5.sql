
-- 1. New enum for conductor
CREATE TYPE public.interview_conductor AS ENUM ('recruiter', 'client');

-- 2. Extend interviews table
ALTER TABLE public.interviews
  ADD COLUMN conducted_by public.interview_conductor NOT NULL DEFAULT 'recruiter',
  ADD COLUMN custom_kind_label text;

-- 3. New table for admin-managed custom round templates
CREATE TABLE public.interview_round_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  default_conducted_by public.interview_conductor NOT NULL DEFAULT 'recruiter',
  default_duration_minutes int NOT NULL DEFAULT 60,
  sort_order int NOT NULL DEFAULT 0,
  archived boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_round_templates TO authenticated;
GRANT ALL ON public.interview_round_templates TO service_role;

ALTER TABLE public.interview_round_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read interview round templates"
  ON public.interview_round_templates FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins leads insert interview round templates"
  ON public.interview_round_templates FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lead_recruiter'::app_role));

CREATE POLICY "Admins leads update interview round templates"
  ON public.interview_round_templates FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lead_recruiter'::app_role));

CREATE POLICY "Admins leads delete interview round templates"
  ON public.interview_round_templates FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lead_recruiter'::app_role));

CREATE TRIGGER set_interview_round_templates_updated_at
  BEFORE UPDATE ON public.interview_round_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
