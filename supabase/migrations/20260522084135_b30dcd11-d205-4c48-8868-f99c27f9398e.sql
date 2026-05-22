
-- Extend existing invoice_status enum
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'cancelled';

-- New enums
DO $$ BEGIN
  CREATE TYPE public.fee_model AS ENUM ('percent_ctc','flat_per_hire','tiered');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.replacement_policy AS ENUM ('free_replacement','pro_rata_credit','none');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.billing_cycle AS ENUM ('monthly','per_joining');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.invoice_line_kind AS ENUM ('placement','replacement_covered','credit_left_in_window');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- client_billing_terms (one row per client)
CREATE TABLE public.client_billing_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  fee_model public.fee_model NOT NULL DEFAULT 'percent_ctc',
  fee_value numeric NOT NULL DEFAULT 8.33,
  tiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  replacement_window_days integer NOT NULL DEFAULT 90,
  replacement_policy public.replacement_policy NOT NULL DEFAULT 'free_replacement',
  billing_cycle public.billing_cycle NOT NULL DEFAULT 'monthly',
  invoice_day_of_month integer NOT NULL DEFAULT 1 CHECK (invoice_day_of_month BETWEEN 1 AND 28),
  payment_terms_days integer NOT NULL DEFAULT 30,
  gst_pct numeric NOT NULL DEFAULT 18,
  tds_pct numeric NOT NULL DEFAULT 10,
  currency text NOT NULL DEFAULT 'INR',
  po_required boolean NOT NULL DEFAULT false,
  po_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_cbt_updated BEFORE UPDATE ON public.client_billing_terms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.client_billing_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view billing terms" ON public.client_billing_terms FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter') OR has_role(auth.uid(),'senior_recruiter') OR has_role(auth.uid(),'recruiter'));
CREATE POLICY "Admins leads insert billing terms" ON public.client_billing_terms FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter'));
CREATE POLICY "Admins leads update billing terms" ON public.client_billing_terms FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter'));
CREATE POLICY "Admins leads delete billing terms" ON public.client_billing_terms FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter'));
CREATE POLICY "Clients view own billing terms" ON public.client_billing_terms FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_billing_terms.client_id AND c.user_id = auth.uid()));

-- invoices
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no text NOT NULL UNIQUE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  period_from date NOT NULL,
  period_to date NOT NULL,
  issue_date date NOT NULL,
  due_date date NOT NULL,
  po_number text,
  subtotal_inr numeric NOT NULL DEFAULT 0,
  gst_inr numeric NOT NULL DEFAULT 0,
  tds_inr numeric NOT NULL DEFAULT 0,
  total_inr numeric NOT NULL DEFAULT 0,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_client ON public.invoices(client_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);

CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view invoices" ON public.invoices FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter') OR has_role(auth.uid(),'senior_recruiter') OR has_role(auth.uid(),'recruiter'));
CREATE POLICY "Staff insert invoices" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter') OR has_role(auth.uid(),'senior_recruiter') OR has_role(auth.uid(),'recruiter'));
CREATE POLICY "Staff update invoices" ON public.invoices FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter') OR has_role(auth.uid(),'senior_recruiter') OR has_role(auth.uid(),'recruiter'));
CREATE POLICY "Admins leads delete invoices" ON public.invoices FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter'));
CREATE POLICY "Clients view own invoices" ON public.invoices FOR SELECT TO authenticated
  USING (status <> 'draft' AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = invoices.client_id AND c.user_id = auth.uid()));

-- invoice_line_items
CREATE TABLE public.invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  placement_id uuid REFERENCES public.placements(id) ON DELETE SET NULL,
  candidate_name text NOT NULL,
  position_title text NOT NULL,
  joining_date date,
  ctc_inr numeric,
  fee_basis text NOT NULL DEFAULT '',
  amount_inr numeric NOT NULL DEFAULT 0,
  kind public.invoice_line_kind NOT NULL DEFAULT 'placement',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ili_invoice ON public.invoice_line_items(invoice_id);

ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view invoice line items" ON public.invoice_line_items FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter') OR has_role(auth.uid(),'senior_recruiter') OR has_role(auth.uid(),'recruiter'));
CREATE POLICY "Staff insert invoice line items" ON public.invoice_line_items FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter') OR has_role(auth.uid(),'senior_recruiter') OR has_role(auth.uid(),'recruiter'));
CREATE POLICY "Staff update invoice line items" ON public.invoice_line_items FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter') OR has_role(auth.uid(),'senior_recruiter') OR has_role(auth.uid(),'recruiter'));
CREATE POLICY "Admins leads delete invoice line items" ON public.invoice_line_items FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'lead_recruiter'));
CREATE POLICY "Clients view own invoice line items" ON public.invoice_line_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    JOIN public.clients c ON c.id = i.client_id
    WHERE i.id = invoice_line_items.invoice_id AND i.status <> 'draft' AND c.user_id = auth.uid()
  ));
