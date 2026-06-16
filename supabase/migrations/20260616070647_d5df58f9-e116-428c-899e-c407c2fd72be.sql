ALTER TABLE public.sourced_candidates
  ADD COLUMN IF NOT EXISTS open_to_work boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_hiring boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS sourced_candidates_open_to_work_idx ON public.sourced_candidates(open_to_work);