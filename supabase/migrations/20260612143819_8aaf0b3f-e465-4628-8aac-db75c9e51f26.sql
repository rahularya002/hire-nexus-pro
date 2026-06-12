CREATE TABLE public.client_custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  permissions text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_custom_roles TO authenticated;
GRANT ALL ON public.client_custom_roles TO service_role;

ALTER TABLE public.client_custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client team can read custom roles"
ON public.client_custom_roles FOR SELECT TO authenticated
USING (
  public.is_client_owner(client_id, auth.uid())
  OR public.is_client_team_member(client_id, auth.uid())
);

CREATE POLICY "Client owner can insert custom roles"
ON public.client_custom_roles FOR INSERT TO authenticated
WITH CHECK (public.is_client_owner(client_id, auth.uid()));

CREATE POLICY "Client owner can update custom roles"
ON public.client_custom_roles FOR UPDATE TO authenticated
USING (public.is_client_owner(client_id, auth.uid()))
WITH CHECK (public.is_client_owner(client_id, auth.uid()));

CREATE POLICY "Client owner can delete custom roles"
ON public.client_custom_roles FOR DELETE TO authenticated
USING (public.is_client_owner(client_id, auth.uid()));

CREATE TRIGGER client_custom_roles_set_updated_at
BEFORE UPDATE ON public.client_custom_roles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.client_members
  ADD COLUMN custom_role_id uuid REFERENCES public.client_custom_roles(id) ON DELETE SET NULL;

ALTER TABLE public.client_members ALTER COLUMN role DROP NOT NULL;

ALTER TABLE public.client_members
  ADD CONSTRAINT client_members_role_xor_custom
  CHECK ((role IS NOT NULL) <> (custom_role_id IS NOT NULL));
