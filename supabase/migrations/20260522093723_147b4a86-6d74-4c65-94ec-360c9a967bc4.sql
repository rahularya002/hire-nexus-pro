CREATE POLICY "Clients insert own positions"
  ON public.positions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = positions.client_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Clients view own positions"
  ON public.positions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = positions.client_id
        AND c.user_id = auth.uid()
    )
  );