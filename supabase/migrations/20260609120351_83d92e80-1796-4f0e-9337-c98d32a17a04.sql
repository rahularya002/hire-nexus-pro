
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
  -- Service role / trusted server context: auth.uid() is NULL.
  -- Require an explicit agency_id and trust it.
  IF uid IS NULL THEN
    IF NEW.agency_id IS NULL THEN
      RAISE EXCEPTION 'agency_id is required for service-role inserts';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.agency_id IS NOT NULL THEN
    IF NOT public.has_role(uid, 'super_admin'::app_role)
       AND NOT public.is_agency_member(NEW.agency_id) THEN
      RAISE EXCEPTION 'Cannot insert row for another agency';
    END IF;
    RETURN NEW;
  END IF;

  SELECT agency_id INTO my_agency
  FROM public.agency_members WHERE user_id = uid LIMIT 1;

  IF my_agency IS NULL AND public.has_role(uid, 'super_admin'::app_role) THEN
    SELECT id INTO my_agency FROM public.agencies ORDER BY created_at LIMIT 1;
  END IF;

  IF my_agency IS NULL THEN
    RAISE EXCEPTION 'User has no agency membership; cannot assign agency_id';
  END IF;

  NEW.agency_id := my_agency;
  RETURN NEW;
END;
$$;
