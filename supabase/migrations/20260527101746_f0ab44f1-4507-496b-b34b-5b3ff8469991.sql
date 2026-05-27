
DROP POLICY IF EXISTS "Clients read own chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Clients upload own chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Clients read own documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Clients upload own documents bucket" ON storage.objects;

CREATE POLICY "Clients read own chat attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.user_id = auth.uid()
      AND c.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Clients upload own chat attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.user_id = auth.uid()
      AND c.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Clients read own documents bucket"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.user_id = auth.uid()
      AND c.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Clients upload own documents bucket"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.user_id = auth.uid()
      AND c.id::text = (storage.foldername(name))[1]
  )
);
