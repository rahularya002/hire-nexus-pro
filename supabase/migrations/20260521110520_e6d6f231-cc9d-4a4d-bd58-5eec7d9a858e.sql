ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);