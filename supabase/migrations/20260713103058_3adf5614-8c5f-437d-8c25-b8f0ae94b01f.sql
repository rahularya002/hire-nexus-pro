
CREATE TABLE public.candidate_screening_calls (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  application_id uuid REFERENCES public.applications(id) ON DELETE SET NULL,
  elevenlabs_conversation_id text,
  mode text NOT NULL DEFAULT 'browser',
  duration_sec integer,
  transcript jsonb,
  summary text,
  verdict text,
  status text NOT NULL DEFAULT 'completed',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_screening_calls TO authenticated;
GRANT ALL ON public.candidate_screening_calls TO service_role;

CREATE INDEX csc_candidate_idx ON public.candidate_screening_calls(candidate_id, created_at DESC);
CREATE INDEX csc_position_idx ON public.candidate_screening_calls(position_id, created_at DESC);
CREATE INDEX csc_agency_idx ON public.candidate_screening_calls(agency_id);

ALTER TABLE public.candidate_screening_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agency staff manage screening calls"
  ON public.candidate_screening_calls
  FOR ALL
  TO authenticated
  USING (public.is_agency_member(agency_id))
  WITH CHECK (public.is_agency_member(agency_id));

CREATE POLICY "client team reads screening calls"
  ON public.candidate_screening_calls
  FOR SELECT
  TO authenticated
  USING (
    position_id IS NOT NULL
    AND public.is_client_team_member_of_position(position_id, auth.uid())
  );

CREATE TRIGGER csc_set_updated_at
  BEFORE UPDATE ON public.candidate_screening_calls
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER csc_set_agency_id
  BEFORE INSERT ON public.candidate_screening_calls
  FOR EACH ROW EXECUTE FUNCTION public.set_agency_id_default();
