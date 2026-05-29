DROP POLICY IF EXISTS "Clients view shared applications" ON public.applications;
CREATE POLICY "Clients view shared applications"
ON public.applications
FOR SELECT
TO authenticated
USING (
  (stage = ANY (ARRAY[
    'shared_with_client'::application_stage,
    'client_shortlist'::application_stage,
    'client_rejected'::application_stage,
    'interview_scheduled'::application_stage,
    'rounds'::application_stage,
    'offered'::application_stage,
    'closed'::application_stage
  ]))
  AND is_client_owner_of_position(position_id, auth.uid())
);

DROP POLICY IF EXISTS "Clients view shared candidates" ON public.candidates;
CREATE POLICY "Clients view shared candidates"
ON public.candidates
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1
  FROM applications a
  JOIN positions p ON p.id = a.position_id
  JOIN clients c ON c.id = p.client_id
  WHERE a.candidate_id = candidates.id
    AND c.user_id = auth.uid()
    AND a.stage = ANY (ARRAY[
      'shared_with_client'::application_stage,
      'client_shortlist'::application_stage,
      'client_rejected'::application_stage,
      'interview_scheduled'::application_stage,
      'rounds'::application_stage,
      'offered'::application_stage,
      'closed'::application_stage
    ])
));