GRANT EXECUTE ON FUNCTION public.is_client_owner_of_position(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;