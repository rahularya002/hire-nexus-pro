-- =========================================================================
-- 1) Restrict role_permissions SELECT to admins + the caller's own roles
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated can read role permissions" ON public.role_permissions;

CREATE POLICY "Users read own role permissions"
ON public.role_permissions
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = role_permissions.role
  )
);

-- =========================================================================
-- 2) Scope staff storage policies to the caller's own agency
--    Documents bucket paths:
--      "<client_id>/jd/..."           (client-uploaded JDs; client policy)
--      "candidates/<uploader_uid>/..." (CV uploads by staff)
--    Chat-attachments paths:
--      "<folder>/<thread_id>/..."     (folder = client_id | agency_id | 'team')
-- =========================================================================
DROP POLICY IF EXISTS "Staff read documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Staff upload documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Staff read chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Staff upload chat attachments" ON storage.objects;

CREATE POLICY "Staff read documents bucket"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'lead_recruiter'::app_role)
    OR public.has_role(auth.uid(), 'senior_recruiter'::app_role)
    OR public.has_role(auth.uid(), 'recruiter'::app_role)
  )
  AND (
    -- Object is registered as a document row in the caller's agency
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.storage_bucket = 'documents'
        AND d.storage_path = objects.name
        AND public.is_agency_member(d.agency_id)
    )
    -- Or it is a candidate CV in the caller's agency
    OR EXISTS (
      SELECT 1 FROM public.candidates c
      WHERE c.resume_url = objects.name
        AND public.is_agency_member(c.agency_id)
    )
    -- Or the top-level folder is a client uuid in the caller's agency
    OR EXISTS (
      SELECT 1 FROM public.clients cl
      WHERE cl.id::text = (storage.foldername(objects.name))[1]
        AND public.is_agency_member(cl.agency_id)
    )
  )
);

CREATE POLICY "Staff upload documents bucket"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'lead_recruiter'::app_role)
    OR public.has_role(auth.uid(), 'senior_recruiter'::app_role)
    OR public.has_role(auth.uid(), 'recruiter'::app_role)
  )
  AND (
    -- CV upload: staff uploading under their own uid subfolder
    (
      (storage.foldername(objects.name))[1] = 'candidates'
      AND (storage.foldername(objects.name))[2] = auth.uid()::text
    )
    -- Or upload into a client folder for a client in the caller's agency
    OR EXISTS (
      SELECT 1 FROM public.clients cl
      WHERE cl.id::text = (storage.foldername(objects.name))[1]
        AND public.is_agency_member(cl.agency_id)
    )
  )
);

CREATE POLICY "Staff read chat attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'lead_recruiter'::app_role)
    OR public.has_role(auth.uid(), 'senior_recruiter'::app_role)
    OR public.has_role(auth.uid(), 'recruiter'::app_role)
  )
  AND EXISTS (
    SELECT 1 FROM public.message_threads t
    WHERE t.id::text = (storage.foldername(objects.name))[2]
      AND public.is_agency_member(t.agency_id)
  )
);

CREATE POLICY "Staff upload chat attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'lead_recruiter'::app_role)
    OR public.has_role(auth.uid(), 'senior_recruiter'::app_role)
    OR public.has_role(auth.uid(), 'recruiter'::app_role)
  )
  AND EXISTS (
    SELECT 1 FROM public.message_threads t
    WHERE t.id::text = (storage.foldername(objects.name))[2]
      AND public.is_agency_member(t.agency_id)
  )
);

-- =========================================================================
-- 3) Lock down SECURITY DEFINER function EXECUTE privileges
--    - Revoke from anon + PUBLIC across the board (none should be callable
--      without an authenticated session).
--    - Trigger-only functions: also revoke from authenticated; triggers
--      run as function owner and don't need EXECUTE grants.
-- =========================================================================

-- RLS helpers used inside policies — keep EXECUTE for authenticated
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_agency_admin(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_agency_member(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_client_owner(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_client_owner_of_position(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_client_owner_of_thread(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_client_team_member(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_client_team_member_of_position(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_client_team_member_of_thread(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_thread(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_user_agency_id() FROM anon, PUBLIC;

-- App RPC — signed-in users only
REVOKE EXECUTE ON FUNCTION public.get_or_create_client_thread(uuid, thread_kind) FROM anon, PUBLIC;

-- Trigger-only functions — no direct callers
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_agency_on_joining() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_agency_on_new_job_application() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_agency_id_default() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bump_thread_last_message_at() FROM anon, authenticated, PUBLIC;