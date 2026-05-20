CREATE TABLE public.role_permissions (
  role public.app_role PRIMARY KEY,
  permissions text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read role permissions"
  ON public.role_permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert role permissions"
  ON public.role_permissions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update role permissions"
  ON public.role_permissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete role permissions"
  ON public.role_permissions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER role_permissions_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.role_permissions (role, permissions) VALUES
  ('admin', ARRAY['candidates.view','candidates.edit','candidates.delete','positions.view','positions.create','positions.assign','clients.view','clients.manage','pipeline.share','pipeline.move','team.view','team.invite','roles.manage','billing.manage']),
  ('lead_recruiter', ARRAY['candidates.view','candidates.edit','positions.view','positions.create','positions.assign','clients.view','clients.manage','pipeline.share','pipeline.move','team.view','team.invite']),
  ('senior_recruiter', ARRAY['candidates.view','candidates.edit','positions.view','positions.create','clients.view','pipeline.share','pipeline.move','team.view']),
  ('recruiter', ARRAY['candidates.view','candidates.edit','positions.view','clients.view','pipeline.move','team.view']),
  ('client', ARRAY[]::text[]);