-- Provide a SECURITY DEFINER helper so clients can create their own recruiter/manager thread
-- without hitting the WITH-CHECK/RETURNING quirk when a plain INSERT is used through PostgREST.
CREATE OR REPLACE FUNCTION public.get_or_create_client_thread(_client_id uuid, _kind public.thread_kind)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tid uuid;
  caller uuid := auth.uid();
  cli_agency uuid;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF _kind NOT IN ('client_recruiter'::public.thread_kind, 'client_manager'::public.thread_kind) THEN
    RAISE EXCEPTION 'unsupported thread kind';
  END IF;

  -- Caller must be a member/owner of the client, OR agency staff for that client's agency.
  SELECT agency_id INTO cli_agency FROM public.clients WHERE id = _client_id;
  IF cli_agency IS NULL THEN
    RAISE EXCEPTION 'client not found';
  END IF;

  IF NOT (
    public.is_client_team_member(_client_id, caller)
    OR public.is_agency_member(cli_agency)
    OR public.has_role(caller, 'super_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'not authorised for this client';
  END IF;

  SELECT id INTO tid FROM public.message_threads
   WHERE client_id = _client_id AND kind = _kind
   LIMIT 1;

  IF tid IS NULL THEN
    INSERT INTO public.message_threads (client_id, kind, agency_id)
    VALUES (_client_id, _kind, cli_agency)
    RETURNING id INTO tid;
  END IF;

  RETURN tid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_client_thread(uuid, public.thread_kind) TO authenticated;