-- Fix insert policy on message_threads so client owners can create their own client_recruiter/client_manager threads.
DROP POLICY IF EXISTS "thread insert agency staff" ON public.message_threads;

CREATE POLICY "thread insert agency staff or client owner"
ON public.message_threads
FOR INSERT
TO authenticated
WITH CHECK (
  -- Agency staff can create any thread in their agency
  (agency_id IS NOT NULL AND public.is_agency_member(agency_id))
  -- Client owner can create their own client_recruiter / client_manager thread
  OR (
    kind IN ('client_recruiter'::thread_kind, 'client_manager'::thread_kind)
    AND client_id IS NOT NULL
    AND public.is_client_owner(client_id, auth.uid())
  )
);