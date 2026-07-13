
CREATE TABLE public.position_ai_screeners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL UNIQUE REFERENCES public.positions(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  job_pitch text NOT NULL DEFAULT '',
  ask_notice_ctc boolean NOT NULL DEFAULT true,
  ask_location boolean NOT NULL DEFAULT true,
  ask_skills boolean NOT NULL DEFAULT true,
  voice_id text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.position_ai_screeners TO authenticated;
GRANT ALL ON public.position_ai_screeners TO service_role;

ALTER TABLE public.position_ai_screeners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "screener_select" ON public.position_ai_screeners FOR SELECT TO authenticated
USING (
  public.is_agency_member(agency_id)
  OR public.is_client_team_member_of_position(position_id, auth.uid())
);

CREATE POLICY "screener_insert" ON public.position_ai_screeners FOR INSERT TO authenticated
WITH CHECK (
  public.is_agency_member(agency_id)
  OR public.is_client_team_member_of_position(position_id, auth.uid())
);

CREATE POLICY "screener_update" ON public.position_ai_screeners FOR UPDATE TO authenticated
USING (
  public.is_agency_member(agency_id)
  OR public.is_client_team_member_of_position(position_id, auth.uid())
)
WITH CHECK (
  public.is_agency_member(agency_id)
  OR public.is_client_team_member_of_position(position_id, auth.uid())
);

CREATE POLICY "screener_delete" ON public.position_ai_screeners FOR DELETE TO authenticated
USING (
  public.is_agency_member(agency_id)
  OR public.is_client_team_member_of_position(position_id, auth.uid())
);

CREATE TRIGGER position_ai_screeners_set_updated_at
BEFORE UPDATE ON public.position_ai_screeners
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
