
-- Recruitment model enum on positions
DO $$ BEGIN
  CREATE TYPE public.recruitment_model AS ENUM ('agency','self','hybrid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS recruitment_model public.recruitment_model NOT NULL DEFAULT 'agency',
  ADD COLUMN IF NOT EXISTS client_assignee_id uuid;

CREATE INDEX IF NOT EXISTS idx_positions_recruitment_model ON public.positions(recruitment_model);
CREATE INDEX IF NOT EXISTS idx_positions_client_assignee ON public.positions(client_assignee_id);

-- Submission source on applications (agency vs client team)
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS submitted_by_kind text NOT NULL DEFAULT 'agency';

-- Client member role enum
DO $$ BEGIN
  CREATE TYPE public.client_member_role AS ENUM ('client_admin','client_recruiter','client_viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Client members table
CREATE TABLE IF NOT EXISTS public.client_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid,
  invited_email text,
  full_name text,
  role public.client_member_role NOT NULL DEFAULT 'client_viewer',
  status text NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_client_members_client ON public.client_members(client_id);
CREATE INDEX IF NOT EXISTS idx_client_members_user ON public.client_members(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_members TO authenticated;
GRANT ALL ON public.client_members TO service_role;

ALTER TABLE public.client_members ENABLE ROW LEVEL SECURITY;

-- Helper: is current user the owner (admin) of a client account?
CREATE OR REPLACE FUNCTION public.is_client_owner(_client_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.clients WHERE id = _client_id AND user_id = _user_id)
$$;

-- Helper: is current user a member of a client team?
CREATE OR REPLACE FUNCTION public.is_client_team_member(_client_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_members
    WHERE client_id = _client_id AND user_id = _user_id AND status = 'active'
  )
$$;

CREATE POLICY "client_members owner manage" ON public.client_members
  FOR ALL TO authenticated
  USING (public.is_client_owner(client_id, auth.uid()))
  WITH CHECK (public.is_client_owner(client_id, auth.uid()));

CREATE POLICY "client_members self view" ON public.client_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_client_team_member(client_id, auth.uid()));

CREATE POLICY "client_members agency view" ON public.client_members
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_members.client_id AND public.is_agency_member(c.agency_id)
  ));

CREATE POLICY "client_members super_admin all" ON public.client_members
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'::app_role));

CREATE TRIGGER trg_client_members_updated_at
  BEFORE UPDATE ON public.client_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Client role permissions table
CREATE TABLE IF NOT EXISTS public.client_role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  role public.client_member_role NOT NULL,
  permissions text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_role_permissions TO authenticated;
GRANT ALL ON public.client_role_permissions TO service_role;

ALTER TABLE public.client_role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crp owner manage" ON public.client_role_permissions
  FOR ALL TO authenticated
  USING (public.is_client_owner(client_id, auth.uid()))
  WITH CHECK (public.is_client_owner(client_id, auth.uid()));

CREATE POLICY "crp team view" ON public.client_role_permissions
  FOR SELECT TO authenticated
  USING (public.is_client_team_member(client_id, auth.uid()));

CREATE POLICY "crp agency view" ON public.client_role_permissions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_role_permissions.client_id AND public.is_agency_member(c.agency_id)
  ));

CREATE POLICY "crp super_admin all" ON public.client_role_permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'::app_role));

CREATE TRIGGER trg_client_role_permissions_updated_at
  BEFORE UPDATE ON public.client_role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
