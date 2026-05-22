
-- ============ ENUMS ============
CREATE TYPE public.message_sender_role AS ENUM ('staff', 'client');
CREATE TYPE public.document_kind AS ENUM ('jd', 'onboarding', 'offer', 'resume', 'other');

-- ============ message_threads ============
CREATE TABLE public.message_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE,
  subject text,
  pinned boolean NOT NULL DEFAULT false,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER message_threads_set_updated_at
  BEFORE UPDATE ON public.message_threads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helper: is the caller the owner-user of a thread's client?
CREATE OR REPLACE FUNCTION public.is_client_owner_of_thread(_thread_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.message_threads t
    JOIN public.clients c ON c.id = t.client_id
    WHERE t.id = _thread_id AND c.user_id = _user_id
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_client_owner_of_thread(uuid, uuid) TO authenticated;

CREATE POLICY "Staff view threads" ON public.message_threads
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter')
    OR has_role(auth.uid(),'senior_recruiter') OR has_role(auth.uid(),'recruiter')
  );
CREATE POLICY "Clients view own thread" ON public.message_threads
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.user_id = auth.uid()));
CREATE POLICY "Staff insert threads" ON public.message_threads
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter')
    OR has_role(auth.uid(),'senior_recruiter') OR has_role(auth.uid(),'recruiter')
  );
CREATE POLICY "Staff update threads" ON public.message_threads
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter')
    OR has_role(auth.uid(),'senior_recruiter') OR has_role(auth.uid(),'recruiter')
  );
CREATE POLICY "Admins leads delete threads" ON public.message_threads
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter'));

-- ============ messages ============
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL,
  sender_id uuid,
  sender_role public.message_sender_role NOT NULL,
  author_name text NOT NULL,
  initials text NOT NULL,
  body text NOT NULL DEFAULT '',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  read_by_client_at timestamptz,
  read_by_staff_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_messages_thread_created ON public.messages (thread_id, created_at);

CREATE POLICY "Staff view messages" ON public.messages
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter')
    OR has_role(auth.uid(),'senior_recruiter') OR has_role(auth.uid(),'recruiter')
  );
CREATE POLICY "Clients view own messages" ON public.messages
  FOR SELECT TO authenticated
  USING (public.is_client_owner_of_thread(thread_id, auth.uid()));
CREATE POLICY "Staff insert messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_role = 'staff' AND (
      has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter')
      OR has_role(auth.uid(),'senior_recruiter') OR has_role(auth.uid(),'recruiter')
    )
  );
CREATE POLICY "Clients insert own messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_role = 'client' AND public.is_client_owner_of_thread(thread_id, auth.uid()));
CREATE POLICY "Staff update messages" ON public.messages
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter')
    OR has_role(auth.uid(),'senior_recruiter') OR has_role(auth.uid(),'recruiter')
  );
CREATE POLICY "Clients update own messages read" ON public.messages
  FOR UPDATE TO authenticated
  USING (public.is_client_owner_of_thread(thread_id, auth.uid()));
CREATE POLICY "Admins leads delete messages" ON public.messages
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter'));

-- Bump thread.last_message_at on insert
CREATE OR REPLACE FUNCTION public.bump_thread_last_message_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.message_threads
    SET last_message_at = NEW.created_at, updated_at = now()
    WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER messages_bump_thread
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_thread_last_message_at();

-- ============ documents ============
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind public.document_kind NOT NULL DEFAULT 'other',
  client_id uuid,
  position_id uuid,
  candidate_id uuid,
  application_id uuid,
  storage_bucket text,
  storage_path text,
  mime text,
  size_bytes bigint,
  required boolean NOT NULL DEFAULT false,
  received boolean NOT NULL DEFAULT true,
  notes text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_documents_client ON public.documents (client_id);
CREATE INDEX idx_documents_position ON public.documents (position_id);

CREATE TRIGGER documents_set_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Staff view documents" ON public.documents
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter')
    OR has_role(auth.uid(),'senior_recruiter') OR has_role(auth.uid(),'recruiter')
  );
CREATE POLICY "Clients view own documents" ON public.documents
  FOR SELECT TO authenticated
  USING (
    (client_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.user_id = auth.uid()))
    OR (position_id IS NOT NULL AND public.is_client_owner_of_position(position_id, auth.uid()))
  );
CREATE POLICY "Staff insert documents" ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter')
    OR has_role(auth.uid(),'senior_recruiter') OR has_role(auth.uid(),'recruiter')
  );
CREATE POLICY "Clients insert own documents" ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (
    (client_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.user_id = auth.uid()))
    OR (position_id IS NOT NULL AND public.is_client_owner_of_position(position_id, auth.uid()))
  );
CREATE POLICY "Staff update documents" ON public.documents
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter')
    OR has_role(auth.uid(),'senior_recruiter') OR has_role(auth.uid(),'recruiter')
  );
CREATE POLICY "Admins leads delete documents" ON public.documents
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter'));

-- ============ STORAGE BUCKETS ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: paths are prefixed with the client_id as the first folder.
-- e.g. "<client_id>/jd/<filename>"
CREATE POLICY "Staff read chat attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-attachments' AND (
      has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter')
      OR has_role(auth.uid(),'senior_recruiter') OR has_role(auth.uid(),'recruiter')
    )
  );
CREATE POLICY "Staff upload chat attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments' AND (
      has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter')
      OR has_role(auth.uid(),'senior_recruiter') OR has_role(auth.uid(),'recruiter')
    )
  );
CREATE POLICY "Clients read own chat attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-attachments' AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.user_id = auth.uid() AND c.id::text = (storage.foldername(name))[1]
    )
  );
CREATE POLICY "Clients upload own chat attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments' AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.user_id = auth.uid() AND c.id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Staff read documents bucket" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents' AND (
      has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter')
      OR has_role(auth.uid(),'senior_recruiter') OR has_role(auth.uid(),'recruiter')
    )
  );
CREATE POLICY "Staff upload documents bucket" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents' AND (
      has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter')
      OR has_role(auth.uid(),'senior_recruiter') OR has_role(auth.uid(),'recruiter')
    )
  );
CREATE POLICY "Clients read own documents bucket" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents' AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.user_id = auth.uid() AND c.id::text = (storage.foldername(name))[1]
    )
  );
CREATE POLICY "Clients upload own documents bucket" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents' AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.user_id = auth.uid() AND c.id::text = (storage.foldername(name))[1]
    )
  );
