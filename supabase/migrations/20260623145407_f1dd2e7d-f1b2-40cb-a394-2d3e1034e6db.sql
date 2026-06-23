
CREATE TABLE public.recruiter_login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  login_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX recruiter_login_events_user_date_uniq
  ON public.recruiter_login_events (user_id, login_date);
CREATE INDEX recruiter_login_events_agency_date_idx
  ON public.recruiter_login_events (agency_id, login_date DESC);

GRANT SELECT, INSERT ON public.recruiter_login_events TO authenticated;
GRANT ALL ON public.recruiter_login_events TO service_role;

ALTER TABLE public.recruiter_login_events ENABLE ROW LEVEL SECURITY;

-- Users can insert their own login event
CREATE POLICY "Users insert own login"
  ON public.recruiter_login_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can see their own login events
CREATE POLICY "Users see own login"
  ON public.recruiter_login_events FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Agency members can see all login events for their agency
CREATE POLICY "Agency members see agency logins"
  ON public.recruiter_login_events FOR SELECT TO authenticated
  USING (public.is_agency_member(agency_id));
