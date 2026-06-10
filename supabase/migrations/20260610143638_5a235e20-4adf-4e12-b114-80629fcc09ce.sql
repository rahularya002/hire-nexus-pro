CREATE OR REPLACE FUNCTION public.set_agency_id_default()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  my_agency uuid;
  client_agency uuid;
BEGIN
  -- Service role / trusted server context: auth.uid() is NULL.
  IF uid IS NULL THEN
    IF NEW.agency_id IS NULL THEN
      RAISE EXCEPTION 'agency_id is required for service-role inserts';
    END IF;
    RETURN NEW;
  END IF;

  -- Explicit agency_id provided: must be super_admin, agency member, or owner of the client (for client-user inserts)
  IF NEW.agency_id IS NOT NULL THEN
    IF public.has_role(uid, 'super_admin'::app_role)
       OR public.is_agency_member(NEW.agency_id) THEN
      RETURN NEW;
    END IF;
    -- Check client-user path: user owns a client in this agency
    IF EXISTS (
      SELECT 1 FROM public.clients
      WHERE user_id = uid AND agency_id = NEW.agency_id
    ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Cannot insert row for another agency';
  END IF;

  -- Try agency staff membership first
  SELECT agency_id INTO my_agency
  FROM public.agency_members WHERE user_id = uid LIMIT 1;

  -- Fallback: client user — derive agency from their client contract.
  -- If TG_TABLE has a client_id column referencing the inserted row's client, use that client's agency.
  IF my_agency IS NULL THEN
    BEGIN
      EXECUTE format(
        'SELECT agency_id FROM public.clients WHERE id = $1.client_id'
      ) INTO client_agency USING NEW;
    EXCEPTION WHEN undefined_column THEN
      client_agency := NULL;
    END;
    IF client_agency IS NOT NULL THEN
      my_agency := client_agency;
    ELSE
      -- Generic fallback: user owns exactly one client → use that agency
      SELECT agency_id INTO my_agency
      FROM public.clients WHERE user_id = uid LIMIT 1;
    END IF;
  END IF;

  IF my_agency IS NULL AND public.has_role(uid, 'super_admin'::app_role) THEN
    SELECT id INTO my_agency FROM public.agencies ORDER BY created_at LIMIT 1;
  END IF;

  IF my_agency IS NULL THEN
    RAISE EXCEPTION 'User has no agency membership; cannot assign agency_id';
  END IF;

  NEW.agency_id := my_agency;
  RETURN NEW;
END;
$function$;