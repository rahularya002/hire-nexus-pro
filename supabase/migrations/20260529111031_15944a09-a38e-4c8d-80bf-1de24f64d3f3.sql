CREATE POLICY "Clients update own application stage"
ON public.applications
FOR UPDATE
TO authenticated
USING (
  is_client_owner_of_position(position_id, auth.uid())
  AND stage = ANY (ARRAY[
    'shared_with_client'::application_stage,
    'client_shortlist'::application_stage,
    'client_rejected'::application_stage,
    'interview_scheduled'::application_stage
  ])
)
WITH CHECK (
  is_client_owner_of_position(position_id, auth.uid())
  AND stage = ANY (ARRAY[
    'client_shortlist'::application_stage,
    'client_rejected'::application_stage,
    'interview_scheduled'::application_stage,
    'shared_with_client'::application_stage
  ])
);