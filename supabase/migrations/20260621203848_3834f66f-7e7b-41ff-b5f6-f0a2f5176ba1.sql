
-- Enums
CREATE TYPE public.job_post_status AS ENUM ('draft','published','closed');
CREATE TYPE public.job_post_channel AS ENUM ('linkedin','naukri','indeed','internal');
CREATE TYPE public.job_post_channel_status AS ENUM ('pending','publishing','published','failed','manual');
CREATE TYPE public.job_application_status AS ENUM ('new','reviewed','converted','rejected');

-- job_posts
CREATE TABLE public.job_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description_md text NOT NULL DEFAULT '',
  location text,
  employment_type text,
  comp_min numeric,
  comp_max numeric,
  currency text DEFAULT 'INR',
  tags text[] NOT NULL DEFAULT '{}',
  status public.job_post_status NOT NULL DEFAULT 'draft',
  is_public boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_posts TO authenticated;
GRANT SELECT ON public.job_posts TO anon;
GRANT ALL ON public.job_posts TO service_role;

ALTER TABLE public.job_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agency members manage job_posts" ON public.job_posts
  FOR ALL TO authenticated
  USING (public.is_agency_member(agency_id))
  WITH CHECK (public.is_agency_member(agency_id));

CREATE POLICY "public can view published public job_posts" ON public.job_posts
  FOR SELECT TO anon
  USING (is_public = true AND status = 'published');

CREATE TRIGGER trg_job_posts_updated_at BEFORE UPDATE ON public.job_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_job_posts_agency BEFORE INSERT ON public.job_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_agency_id_default();

CREATE INDEX idx_job_posts_agency ON public.job_posts(agency_id);
CREATE INDEX idx_job_posts_position ON public.job_posts(position_id);

-- job_post_channels
CREATE TABLE public.job_post_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_post_id uuid NOT NULL REFERENCES public.job_posts(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  channel public.job_post_channel NOT NULL,
  status public.job_post_channel_status NOT NULL DEFAULT 'pending',
  external_post_id text,
  external_url text,
  error text,
  last_synced_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_post_id, channel)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_post_channels TO authenticated;
GRANT ALL ON public.job_post_channels TO service_role;

ALTER TABLE public.job_post_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agency members manage job_post_channels" ON public.job_post_channels
  FOR ALL TO authenticated
  USING (public.is_agency_member(agency_id))
  WITH CHECK (public.is_agency_member(agency_id));

CREATE TRIGGER trg_job_post_channels_updated_at BEFORE UPDATE ON public.job_post_channels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_job_post_channels_agency BEFORE INSERT ON public.job_post_channels
  FOR EACH ROW EXECUTE FUNCTION public.set_agency_id_default();

CREATE INDEX idx_job_post_channels_post ON public.job_post_channels(job_post_id);

-- job_applications
CREATE TABLE public.job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_post_id uuid NOT NULL REFERENCES public.job_posts(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  channel public.job_post_channel NOT NULL DEFAULT 'internal',
  applicant_name text NOT NULL,
  email text,
  phone text,
  resume_doc_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  resume_url text,
  cover_note text,
  source_url text,
  raw jsonb,
  status public.job_application_status NOT NULL DEFAULT 'new',
  candidate_id uuid REFERENCES public.candidates(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE, DELETE ON public.job_applications TO authenticated;
GRANT INSERT ON public.job_applications TO anon;
GRANT ALL ON public.job_applications TO service_role;

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agency members read job_applications" ON public.job_applications
  FOR SELECT TO authenticated
  USING (public.is_agency_member(agency_id));
CREATE POLICY "agency members update job_applications" ON public.job_applications
  FOR UPDATE TO authenticated
  USING (public.is_agency_member(agency_id))
  WITH CHECK (public.is_agency_member(agency_id));
CREATE POLICY "agency members delete job_applications" ON public.job_applications
  FOR DELETE TO authenticated
  USING (public.is_agency_member(agency_id));
CREATE POLICY "anon can apply to published public posts" ON public.job_applications
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.job_posts p
      WHERE p.id = job_post_id
        AND p.is_public = true
        AND p.status = 'published'
        AND p.agency_id = job_applications.agency_id
    )
  );

CREATE TRIGGER trg_job_applications_updated_at BEFORE UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_job_applications_post ON public.job_applications(job_post_id);
CREATE INDEX idx_job_applications_agency ON public.job_applications(agency_id);

-- Notify agency members on new application
CREATE OR REPLACE FUNCTION public.notify_agency_on_new_job_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_title text;
  member_id uuid;
BEGIN
  SELECT title INTO post_title FROM public.job_posts WHERE id = NEW.job_post_id;
  FOR member_id IN
    SELECT user_id FROM public.agency_members WHERE agency_id = NEW.agency_id
  LOOP
    INSERT INTO public.notifications (user_id, kind, title, body, link)
    VALUES (
      member_id,
      'invoice_due'::notification_kind,
      'New job application',
      COALESCE(NEW.applicant_name, 'Someone') || ' applied to ' || COALESCE(post_title, 'a job post'),
      '/posting/' || NEW.job_post_id::text
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_job_applications_notify
  AFTER INSERT ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_agency_on_new_job_application();
