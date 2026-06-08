
ALTER TABLE public.candidates
ADD COLUMN IF NOT EXISTS linkedin_url text;

GRANT SELECT, INSERT, UPDATE ON public.candidates TO authenticated;
GRANT ALL ON public.candidates TO service_role;
