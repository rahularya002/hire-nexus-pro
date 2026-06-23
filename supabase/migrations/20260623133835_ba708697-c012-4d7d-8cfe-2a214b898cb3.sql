CREATE POLICY "client updates shared candidates"
ON public.candidates
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM applications a
    JOIN positions p ON p.id = a.position_id
    JOIN clients c ON c.id = p.client_id
    WHERE a.candidate_id = candidates.id
      AND c.user_id = auth.uid()
      AND a.stage = ANY (ARRAY['shared_with_client','client_shortlist','client_rejected','interview_scheduled','rounds','offered','closed']::application_stage[])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM applications a
    JOIN positions p ON p.id = a.position_id
    JOIN clients c ON c.id = p.client_id
    WHERE a.candidate_id = candidates.id
      AND c.user_id = auth.uid()
      AND a.stage = ANY (ARRAY['shared_with_client','client_shortlist','client_rejected','interview_scheduled','rounds','offered','closed']::application_stage[])
  )
);