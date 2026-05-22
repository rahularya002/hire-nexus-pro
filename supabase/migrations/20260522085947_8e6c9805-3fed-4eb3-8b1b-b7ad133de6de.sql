-- No schema changes needed; ensure unique constraint exists for upsert by client_id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_billing_terms_client_id_key'
  ) THEN
    ALTER TABLE public.client_billing_terms
      ADD CONSTRAINT client_billing_terms_client_id_key UNIQUE (client_id);
  END IF;
END $$;