
-- Enum for thread kind
DO $$ BEGIN
  CREATE TYPE public.thread_kind AS ENUM ('client_recruiter','client_manager','team_room','team_dm');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Columns
ALTER TABLE public.message_threads
  ADD COLUMN IF NOT EXISTS kind public.thread_kind NOT NULL DEFAULT 'client_recruiter',
  ADD COLUMN IF NOT EXISTS participant_a uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS participant_b uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Allow team threads without a client
ALTER TABLE public.message_threads ALTER COLUMN client_id DROP NOT NULL;

-- Replace old uniqueness (one-per-client) with kind-aware indexes
ALTER TABLE public.message_threads DROP CONSTRAINT IF EXISTS message_threads_client_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS message_threads_client_kind_uidx
  ON public.message_threads (client_id, kind)
  WHERE kind IN ('client_recruiter','client_manager');

CREATE UNIQUE INDEX IF NOT EXISTS message_threads_team_room_uidx
  ON public.message_threads (agency_id)
  WHERE kind = 'team_room';

CREATE UNIQUE INDEX IF NOT EXISTS message_threads_team_dm_uidx
  ON public.message_threads (
    agency_id,
    LEAST(participant_a, participant_b),
    GREATEST(participant_a, participant_b)
  )
  WHERE kind = 'team_dm';

-- Helper: is user an agency admin (manager) of the agency?
CREATE OR REPLACE FUNCTION public.is_agency_admin(_agency_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agency_members
    WHERE agency_id = _agency_id AND user_id = _user_id AND role_in_agency = 'admin'
  );
$$;

-- Helper: can current user see a thread row (used by messages policies)
CREATE OR REPLACE FUNCTION public.can_access_thread(_thread_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.message_threads t
    WHERE t.id = _thread_id
      AND (
        -- team room: any agency member
        (t.kind = 'team_room' AND public.is_agency_member(t.agency_id))
        -- team dm: only the two participants
        OR (t.kind = 'team_dm' AND (_user_id = t.participant_a OR _user_id = t.participant_b))
        -- client recruiter: client team + all agency staff
        OR (t.kind = 'client_recruiter' AND (
          public.is_client_team_member(t.client_id, _user_id)
          OR public.is_agency_member(t.agency_id)
        ))
        -- client manager: client owner/team + agency admins only
        OR (t.kind = 'client_manager' AND (
          public.is_client_team_member(t.client_id, _user_id)
          OR public.is_agency_admin(t.agency_id, _user_id)
        ))
      )
  );
$$;

-- Rebuild message_threads policies
DROP POLICY IF EXISTS "agency staff all" ON public.message_threads;
DROP POLICY IF EXISTS "client inserts own threads" ON public.message_threads;
DROP POLICY IF EXISTS "client member sees threads" ON public.message_threads;
DROP POLICY IF EXISTS "client sees own threads" ON public.message_threads;

-- SELECT: any user who satisfies access rules
CREATE POLICY "thread select by access" ON public.message_threads
  FOR SELECT TO authenticated
  USING (public.can_access_thread(id, auth.uid()));

-- INSERT: agency staff (rooms/dms/client threads for their agency); or client owner creating own client thread
CREATE POLICY "thread insert agency staff" ON public.message_threads
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_agency_member(agency_id)
    OR (
      kind IN ('client_recruiter','client_manager')
      AND client_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.user_id = auth.uid())
    )
  );

-- UPDATE/DELETE: agency staff of the agency
CREATE POLICY "thread modify agency staff" ON public.message_threads
  FOR UPDATE TO authenticated
  USING (public.is_agency_member(agency_id))
  WITH CHECK (public.is_agency_member(agency_id));

CREATE POLICY "thread delete agency staff" ON public.message_threads
  FOR DELETE TO authenticated
  USING (public.is_agency_member(agency_id));

-- Messages: rebuild around can_access_thread
DROP POLICY IF EXISTS "agency staff all" ON public.messages;
DROP POLICY IF EXISTS "client inserts own messages" ON public.messages;
DROP POLICY IF EXISTS "client member sees messages" ON public.messages;
DROP POLICY IF EXISTS "client sees own messages" ON public.messages;

CREATE POLICY "messages select by thread access" ON public.messages
  FOR SELECT TO authenticated
  USING (public.can_access_thread(thread_id, auth.uid()));

CREATE POLICY "messages insert by thread access" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_thread(thread_id, auth.uid())
    AND sender_id = auth.uid()
  );

CREATE POLICY "messages update marker by thread access" ON public.messages
  FOR UPDATE TO authenticated
  USING (public.can_access_thread(thread_id, auth.uid()))
  WITH CHECK (public.can_access_thread(thread_id, auth.uid()));

-- Backfill: existing rows are recruiter threads (default already set); nothing else needed
UPDATE public.message_threads SET kind = 'client_recruiter' WHERE kind IS NULL;
