
-- ============================================================
-- P0: Multi-tenant isolation
-- ============================================================

-- 1. Helper functions ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_agency_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_agency_member(_agency_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agency_members
    WHERE user_id = auth.uid() AND agency_id = _agency_id
  )
$$;

-- 2. Add agency_id columns -----------------------------------------------
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'clients','positions','candidates','applications','interviews',
    'placements','invoices','invoice_line_items','client_billing_terms',
    'documents','message_threads','tasks','activities',
    'sourced_candidates','position_sourcing_runs','position_sourced_matches',
    'interview_round_templates','scout_source_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE',
      t
    );
  END LOOP;
END $$;

-- 3. Backfill all existing data to the Default Agency -------------------
DO $$
DECLARE
  default_agency uuid;
  t text;
  tenant_tables text[] := ARRAY[
    'clients','positions','candidates','applications','interviews',
    'placements','invoices','invoice_line_items','client_billing_terms',
    'documents','message_threads','tasks','activities',
    'sourced_candidates','position_sourcing_runs','position_sourced_matches',
    'interview_round_templates','scout_source_settings'
  ];
BEGIN
  SELECT id INTO default_agency FROM public.agencies WHERE slug = 'default' LIMIT 1;
  IF default_agency IS NULL THEN
    SELECT id INTO default_agency FROM public.agencies ORDER BY created_at LIMIT 1;
  END IF;
  IF default_agency IS NULL THEN
    RAISE EXCEPTION 'No agency exists to backfill into';
  END IF;
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('UPDATE public.%I SET agency_id = %L WHERE agency_id IS NULL', t, default_agency);
  END LOOP;
END $$;

-- 4. NOT NULL + index ----------------------------------------------------
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'clients','positions','candidates','applications','interviews',
    'placements','invoices','invoice_line_items','client_billing_terms',
    'documents','message_threads','tasks','activities',
    'sourced_candidates','position_sourcing_runs','position_sourced_matches',
    'interview_round_templates','scout_source_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN agency_id SET NOT NULL', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (agency_id)',
      t || '_agency_id_idx', t);
  END LOOP;
END $$;

-- 5. Auto-stamp trigger --------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_agency_id_default()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  my_agency uuid;
BEGIN
  IF NEW.agency_id IS NOT NULL THEN
    -- Only super_admin may set agency_id directly to an agency they're not in
    IF NOT public.has_role(uid, 'super_admin'::app_role)
       AND NOT public.is_agency_member(NEW.agency_id) THEN
      RAISE EXCEPTION 'Cannot insert row for another agency';
    END IF;
    RETURN NEW;
  END IF;

  SELECT agency_id INTO my_agency
  FROM public.agency_members WHERE user_id = uid LIMIT 1;

  IF my_agency IS NULL THEN
    -- Fall back: if super_admin and only one agency exists, use it
    IF public.has_role(uid, 'super_admin'::app_role) THEN
      SELECT id INTO my_agency FROM public.agencies ORDER BY created_at LIMIT 1;
    END IF;
  END IF;

  IF my_agency IS NULL THEN
    RAISE EXCEPTION 'User has no agency membership; cannot assign agency_id';
  END IF;

  NEW.agency_id := my_agency;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'clients','positions','candidates','applications','interviews',
    'placements','invoices','invoice_line_items','client_billing_terms',
    'documents','message_threads','tasks','activities',
    'sourced_candidates','position_sourcing_runs','position_sourced_matches',
    'interview_round_templates','scout_source_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_agency_id_default_trg ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER set_agency_id_default_trg BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_agency_id_default()',
      t
    );
  END LOOP;
END $$;

-- 6. Drop all existing policies on tenant tables ------------------------
DO $$
DECLARE
  r record;
  tenant_tables text[] := ARRAY[
    'clients','positions','candidates','applications','interviews',
    'placements','invoices','invoice_line_items','client_billing_terms',
    'documents','message_threads','tasks','activities',
    'sourced_candidates','position_sourcing_runs','position_sourced_matches',
    'interview_round_templates','scout_source_settings','messages'
  ];
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = ANY(tenant_tables)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- 7. Recreate policies: super_admin + agency-staff + client-portal ------
-- Helper macro pattern: each table gets
--   "super_admin all"
--   "agency staff all"
-- plus client-portal policies preserved.

-- CLIENTS
CREATE POLICY "super_admin all" ON public.clients FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "agency staff all" ON public.clients FOR ALL TO authenticated
  USING (is_agency_member(agency_id))
  WITH CHECK (is_agency_member(agency_id));
CREATE POLICY "client sees own row" ON public.clients FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- POSITIONS
CREATE POLICY "super_admin all" ON public.positions FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "agency staff all" ON public.positions FOR ALL TO authenticated
  USING (is_agency_member(agency_id))
  WITH CHECK (is_agency_member(agency_id));
CREATE POLICY "client sees own positions" ON public.positions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = positions.client_id AND c.user_id = auth.uid()));
CREATE POLICY "client inserts own positions" ON public.positions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = positions.client_id AND c.user_id = auth.uid()));

-- CANDIDATES
CREATE POLICY "super_admin all" ON public.candidates FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "agency staff all" ON public.candidates FOR ALL TO authenticated
  USING (is_agency_member(agency_id))
  WITH CHECK (is_agency_member(agency_id));
CREATE POLICY "client sees shared candidates" ON public.candidates FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.applications a
    JOIN public.positions p ON p.id = a.position_id
    JOIN public.clients c ON c.id = p.client_id
    WHERE a.candidate_id = candidates.id
      AND c.user_id = auth.uid()
      AND a.stage IN ('shared_with_client','client_shortlist','client_rejected','interview_scheduled','rounds','offered','closed')
  ));

-- APPLICATIONS
CREATE POLICY "super_admin all" ON public.applications FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "agency staff all" ON public.applications FOR ALL TO authenticated
  USING (is_agency_member(agency_id))
  WITH CHECK (is_agency_member(agency_id));
CREATE POLICY "client sees shared applications" ON public.applications FOR SELECT TO authenticated
  USING (is_client_owner_of_position(position_id, auth.uid())
         AND stage IN ('shared_with_client','client_shortlist','client_rejected','interview_scheduled','rounds','offered','closed'));
CREATE POLICY "client updates own application stage" ON public.applications FOR UPDATE TO authenticated
  USING (is_client_owner_of_position(position_id, auth.uid())
         AND stage IN ('shared_with_client','client_shortlist','client_rejected','interview_scheduled'))
  WITH CHECK (is_client_owner_of_position(position_id, auth.uid())
         AND stage IN ('client_shortlist','client_rejected','interview_scheduled','shared_with_client'));

-- INTERVIEWS
CREATE POLICY "super_admin all" ON public.interviews FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "agency staff all" ON public.interviews FOR ALL TO authenticated
  USING (is_agency_member(agency_id))
  WITH CHECK (is_agency_member(agency_id));
CREATE POLICY "client sees own interviews" ON public.interviews FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.applications a
    JOIN public.positions p ON p.id = a.position_id
    JOIN public.clients c ON c.id = p.client_id
    WHERE a.id = interviews.application_id AND c.user_id = auth.uid()
  ));

-- PLACEMENTS
CREATE POLICY "super_admin all" ON public.placements FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "agency staff all" ON public.placements FOR ALL TO authenticated
  USING (is_agency_member(agency_id))
  WITH CHECK (is_agency_member(agency_id));
CREATE POLICY "client sees own placements" ON public.placements FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = placements.client_id AND c.user_id = auth.uid()));

-- INVOICES
CREATE POLICY "super_admin all" ON public.invoices FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "agency staff all" ON public.invoices FOR ALL TO authenticated
  USING (is_agency_member(agency_id))
  WITH CHECK (is_agency_member(agency_id));
CREATE POLICY "client sees own invoices" ON public.invoices FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = invoices.client_id AND c.user_id = auth.uid()));

-- INVOICE LINE ITEMS
CREATE POLICY "super_admin all" ON public.invoice_line_items FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "agency staff all" ON public.invoice_line_items FOR ALL TO authenticated
  USING (is_agency_member(agency_id))
  WITH CHECK (is_agency_member(agency_id));
CREATE POLICY "client sees own invoice lines" ON public.invoice_line_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    JOIN public.clients c ON c.id = i.client_id
    WHERE i.id = invoice_line_items.invoice_id AND c.user_id = auth.uid()
  ));

-- CLIENT BILLING TERMS
CREATE POLICY "super_admin all" ON public.client_billing_terms FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "agency staff all" ON public.client_billing_terms FOR ALL TO authenticated
  USING (is_agency_member(agency_id))
  WITH CHECK (is_agency_member(agency_id));
CREATE POLICY "client sees own billing terms" ON public.client_billing_terms FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_billing_terms.client_id AND c.user_id = auth.uid()));

-- DOCUMENTS
CREATE POLICY "super_admin all" ON public.documents FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "agency staff all" ON public.documents FOR ALL TO authenticated
  USING (is_agency_member(agency_id))
  WITH CHECK (is_agency_member(agency_id));
CREATE POLICY "client sees own documents" ON public.documents FOR SELECT TO authenticated
  USING (client_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = documents.client_id AND c.user_id = auth.uid()));
CREATE POLICY "client inserts own documents" ON public.documents FOR INSERT TO authenticated
  WITH CHECK (client_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = documents.client_id AND c.user_id = auth.uid()));

-- MESSAGE THREADS
CREATE POLICY "super_admin all" ON public.message_threads FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "agency staff all" ON public.message_threads FOR ALL TO authenticated
  USING (is_agency_member(agency_id))
  WITH CHECK (is_agency_member(agency_id));
CREATE POLICY "client sees own threads" ON public.message_threads FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = message_threads.client_id AND c.user_id = auth.uid()));
CREATE POLICY "client inserts own threads" ON public.message_threads FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = message_threads.client_id AND c.user_id = auth.uid()));

-- MESSAGES (scoped via parent thread)
CREATE POLICY "super_admin all" ON public.messages FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "agency staff all" ON public.messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.message_threads t WHERE t.id = messages.thread_id AND is_agency_member(t.agency_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.message_threads t WHERE t.id = messages.thread_id AND is_agency_member(t.agency_id)));
CREATE POLICY "client sees own messages" ON public.messages FOR SELECT TO authenticated
  USING (is_client_owner_of_thread(thread_id, auth.uid()));
CREATE POLICY "client inserts own messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (is_client_owner_of_thread(thread_id, auth.uid()) AND sender_id = auth.uid());

-- TASKS
CREATE POLICY "super_admin all" ON public.tasks FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "agency staff all" ON public.tasks FOR ALL TO authenticated
  USING (is_agency_member(agency_id))
  WITH CHECK (is_agency_member(agency_id));

-- ACTIVITIES
CREATE POLICY "super_admin all" ON public.activities FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "agency staff all" ON public.activities FOR ALL TO authenticated
  USING (is_agency_member(agency_id))
  WITH CHECK (is_agency_member(agency_id));
CREATE POLICY "client sees own activities" ON public.activities FOR SELECT TO authenticated
  USING (client_visible = true AND position_id IS NOT NULL AND is_client_owner_of_position(position_id, auth.uid()));

-- SOURCED CANDIDATES / SOURCING RUNS / SOURCED MATCHES
CREATE POLICY "super_admin all" ON public.sourced_candidates FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "agency staff all" ON public.sourced_candidates FOR ALL TO authenticated
  USING (is_agency_member(agency_id)) WITH CHECK (is_agency_member(agency_id));

CREATE POLICY "super_admin all" ON public.position_sourcing_runs FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "agency staff all" ON public.position_sourcing_runs FOR ALL TO authenticated
  USING (is_agency_member(agency_id)) WITH CHECK (is_agency_member(agency_id));

CREATE POLICY "super_admin all" ON public.position_sourced_matches FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "agency staff all" ON public.position_sourced_matches FOR ALL TO authenticated
  USING (is_agency_member(agency_id)) WITH CHECK (is_agency_member(agency_id));

-- INTERVIEW ROUND TEMPLATES
CREATE POLICY "super_admin all" ON public.interview_round_templates FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "agency staff all" ON public.interview_round_templates FOR ALL TO authenticated
  USING (is_agency_member(agency_id)) WITH CHECK (is_agency_member(agency_id));

-- SCOUT SOURCE SETTINGS
CREATE POLICY "super_admin all" ON public.scout_source_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "agency staff all" ON public.scout_source_settings FOR ALL TO authenticated
  USING (is_agency_member(agency_id)) WITH CHECK (is_agency_member(agency_id));
