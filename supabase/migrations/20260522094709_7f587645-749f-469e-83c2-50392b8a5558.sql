-- Add recruiter assignment to positions
ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS assigned_recruiter_id uuid;

CREATE INDEX IF NOT EXISTS idx_positions_assigned_recruiter
  ON public.positions(assigned_recruiter_id);
