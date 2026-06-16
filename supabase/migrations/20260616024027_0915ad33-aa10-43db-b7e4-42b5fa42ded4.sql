
-- Add invoice_due to notification kind enum
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'invoice_due';

-- Trigger function: when placement joining_date is set/changed, notify agency members
CREATE OR REPLACE FUNCTION public.notify_agency_on_joining()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate_name TEXT;
  client_name TEXT;
  position_title TEXT;
  member_id UUID;
BEGIN
  -- Only act when joining_date is set and it's new or changed
  IF NEW.joining_date IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.joining_date IS NOT DISTINCT FROM NEW.joining_date THEN
    RETURN NEW;
  END IF;

  SELECT name INTO candidate_name FROM public.candidates WHERE id = NEW.candidate_id;
  SELECT name INTO client_name FROM public.clients WHERE id = NEW.client_id;
  SELECT title INTO position_title FROM public.positions WHERE id = NEW.position_id;

  FOR member_id IN
    SELECT user_id FROM public.agency_members WHERE agency_id = NEW.agency_id
  LOOP
    INSERT INTO public.notifications (user_id, kind, title, body, link)
    VALUES (
      member_id,
      'invoice_due'::notification_kind,
      'Candidate joined — raise invoice',
      COALESCE(candidate_name, 'A candidate') || ' joined ' || COALESCE(client_name, 'a client') ||
        ' for ' || COALESCE(position_title, 'a position') || ' on ' || NEW.joining_date::text || '. Generate invoice.',
      '/billing/clients/' || NEW.client_id::text
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_placements_notify_joining ON public.placements;
CREATE TRIGGER trg_placements_notify_joining
AFTER INSERT OR UPDATE OF joining_date ON public.placements
FOR EACH ROW
EXECUTE FUNCTION public.notify_agency_on_joining();
