CREATE POLICY "Clients view own client row"
  ON public.clients FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());