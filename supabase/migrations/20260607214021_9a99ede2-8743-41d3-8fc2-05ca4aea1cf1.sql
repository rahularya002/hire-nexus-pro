
-- Enums
DO $$ BEGIN
  CREATE TYPE public.agency_status AS ENUM ('trial','active','suspended','rejected','pending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.agency_plan AS ENUM ('starter','professional','enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ticket_status AS ENUM ('open','in_progress','resolved','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ticket_type AS ENUM ('support','billing','feature_request');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- agencies
CREATE TABLE public.agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.agency_status NOT NULL DEFAULT 'trial',
  plan public.agency_plan NOT NULL DEFAULT 'starter',
  trial_ends_at timestamptz,
  mrr_cents integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agencies TO authenticated;
GRANT ALL ON public.agencies TO service_role;
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin manages agencies" ON public.agencies
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER agencies_set_updated_at BEFORE UPDATE ON public.agencies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- agency_members
CREATE TABLE public.agency_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_in_agency text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_members TO authenticated;
GRANT ALL ON public.agency_members TO service_role;
ALTER TABLE public.agency_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin manages agency members" ON public.agency_members
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- support_tickets
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES public.agencies(id) ON DELETE SET NULL,
  type public.ticket_type NOT NULL DEFAULT 'support',
  subject text NOT NULL,
  body text,
  status public.ticket_status NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin manages tickets" ON public.support_tickets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER tickets_set_updated_at BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Promote existing admin to super_admin
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'super_admin'::public.app_role
FROM public.profiles p
JOIN public.user_roles r ON r.user_id = p.id AND r.role = 'admin'
WHERE p.email = 'admin@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Seed default agency and link existing users
INSERT INTO public.agencies (name, slug, status, plan, mrr_cents, notes)
VALUES ('Default Agency', 'default', 'active', 'professional', 0, 'Auto-created from existing users.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.agency_members (agency_id, user_id, role_in_agency)
SELECT a.id, ur.user_id, ur.role::text
FROM public.agencies a
CROSS JOIN public.user_roles ur
WHERE a.slug = 'default'
  AND ur.role IN ('admin','lead_recruiter','senior_recruiter','recruiter')
ON CONFLICT (agency_id, user_id) DO NOTHING;
