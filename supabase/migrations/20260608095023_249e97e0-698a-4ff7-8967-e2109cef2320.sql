
-- 1) Remove admin role from admin@gmail.com (keep super_admin)
DELETE FROM public.user_roles
WHERE user_id = (SELECT id FROM public.profiles WHERE email = 'admin@gmail.com')
  AND role = 'admin';

-- 2) Create agency@gmail.com auth user if not exists
DO $$
DECLARE
  new_uid uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'agency@gmail.com') THEN
    new_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', new_uid, 'authenticated', 'authenticated',
      'agency@gmail.com', crypt('password123', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Agency Admin"}'::jsonb,
      '', '', '', ''
    );

    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), new_uid,
      jsonb_build_object('sub', new_uid::text, 'email', 'agency@gmail.com'),
      'email', new_uid::text, now(), now(), now());
  ELSE
    SELECT id INTO new_uid FROM auth.users WHERE email = 'agency@gmail.com';
  END IF;

  -- Ensure profile exists and is active
  INSERT INTO public.profiles (id, email, full_name, status)
  VALUES (new_uid, 'agency@gmail.com', 'Agency Admin', 'active')
  ON CONFLICT (id) DO UPDATE SET status = 'active', email = EXCLUDED.email;

  -- Ensure admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new_uid, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;
