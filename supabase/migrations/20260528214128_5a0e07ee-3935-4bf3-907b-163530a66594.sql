CREATE TABLE public.scout_source_settings (
  source_id text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  actor_slug text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.scout_source_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.scout_source_settings TO authenticated;
GRANT ALL ON public.scout_source_settings TO service_role;

ALTER TABLE public.scout_source_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read scout source settings"
  ON public.scout_source_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins leads insert scout source settings"
  ON public.scout_source_settings FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lead_recruiter'::app_role));

CREATE POLICY "Admins leads update scout source settings"
  ON public.scout_source_settings FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lead_recruiter'::app_role));

CREATE POLICY "Admins leads delete scout source settings"
  ON public.scout_source_settings FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lead_recruiter'::app_role));

CREATE TRIGGER set_scout_source_settings_updated_at
  BEFORE UPDATE ON public.scout_source_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();