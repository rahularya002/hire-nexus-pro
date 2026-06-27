
CREATE TABLE public.google_calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  google_email text NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  scopes text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_calendar_connections TO authenticated;
GRANT ALL ON public.google_calendar_connections TO service_role;

ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own google connection select"
  ON public.google_calendar_connections FOR SELECT
  TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users manage own google connection insert"
  ON public.google_calendar_connections FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users manage own google connection update"
  ON public.google_calendar_connections FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users manage own google connection delete"
  ON public.google_calendar_connections FOR DELETE
  TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER google_calendar_connections_updated_at
  BEFORE UPDATE ON public.google_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS external_event_id text,
  ADD COLUMN IF NOT EXISTS external_provider text;
