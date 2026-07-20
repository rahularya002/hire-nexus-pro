ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS source_client_id uuid NULL
  REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS candidates_source_client_id_idx
  ON public.candidates(source_client_id);