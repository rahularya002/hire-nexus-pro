-- Enums
CREATE TYPE public.task_state AS ENUM ('Pending', 'Ongoing', 'Interview Pending', 'Closed', 'Reopened', 'No-show');
CREATE TYPE public.task_sla AS ENUM ('ok', 'warning', 'breach');
CREATE TYPE public.activity_kind AS ENUM (
  'call', 'shortlist', 'share', 'interview_scheduled', 'interview_completed',
  'offer', 'closure', 'note', 'submission', 'document', 'message', 'stage_change'
);

-- Tasks
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'Call candidate',
  state public.task_state NOT NULL DEFAULT 'Pending',
  sla public.task_sla NOT NULL DEFAULT 'ok',
  due_at timestamptz,
  due_label text,
  assigned_to uuid,
  client_id uuid,
  position_id uuid,
  candidate_id uuid,
  application_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view tasks" ON public.tasks FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'lead_recruiter'::app_role)
    OR has_role(auth.uid(),'senior_recruiter'::app_role) OR has_role(auth.uid(),'recruiter'::app_role));
CREATE POLICY "Staff insert tasks" ON public.tasks FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'lead_recruiter'::app_role)
    OR has_role(auth.uid(),'senior_recruiter'::app_role) OR has_role(auth.uid(),'recruiter'::app_role));
CREATE POLICY "Staff update tasks" ON public.tasks FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'lead_recruiter'::app_role)
    OR has_role(auth.uid(),'senior_recruiter'::app_role) OR has_role(auth.uid(),'recruiter'::app_role));
CREATE POLICY "Admins leads delete tasks" ON public.tasks FOR DELETE TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'lead_recruiter'::app_role));

CREATE TRIGGER tasks_set_updated_at BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Activities
CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.activity_kind NOT NULL,
  title text NOT NULL,
  detail text,
  client_id uuid,
  position_id uuid,
  candidate_id uuid,
  application_id uuid,
  actor_id uuid,
  client_visible boolean NOT NULL DEFAULT false,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view activities" ON public.activities FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'lead_recruiter'::app_role)
    OR has_role(auth.uid(),'senior_recruiter'::app_role) OR has_role(auth.uid(),'recruiter'::app_role));
CREATE POLICY "Clients view own activities" ON public.activities FOR SELECT TO authenticated
USING (
  client_visible = true
  AND position_id IS NOT NULL
  AND is_client_owner_of_position(position_id, auth.uid())
);
CREATE POLICY "Staff insert activities" ON public.activities FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'lead_recruiter'::app_role)
    OR has_role(auth.uid(),'senior_recruiter'::app_role) OR has_role(auth.uid(),'recruiter'::app_role));
CREATE POLICY "Staff update activities" ON public.activities FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'lead_recruiter'::app_role)
    OR has_role(auth.uid(),'senior_recruiter'::app_role) OR has_role(auth.uid(),'recruiter'::app_role));
CREATE POLICY "Admins leads delete activities" ON public.activities FOR DELETE TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'lead_recruiter'::app_role));

CREATE INDEX activities_occurred_at_idx ON public.activities (occurred_at DESC);
CREATE INDEX activities_client_id_idx ON public.activities (client_id);
CREATE INDEX activities_position_id_idx ON public.activities (position_id);
CREATE INDEX tasks_state_idx ON public.tasks (state);
CREATE INDEX tasks_assigned_to_idx ON public.tasks (assigned_to);