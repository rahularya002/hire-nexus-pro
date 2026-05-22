
-- Notification kinds and table
CREATE TYPE public.notification_kind AS ENUM (
  'interview_reminder',
  'task_sla_breach',
  'invoice_overdue',
  'system'
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind public.notification_kind NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  related_interview_id uuid,
  related_task_id uuid,
  related_invoice_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_created ON public.notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id) WHERE read_at IS NULL;

-- Dedup keys so cron doesn't re-fire same alert
CREATE TABLE public.notification_dedup (
  dedup_key text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins view all notifications" ON public.notifications
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
