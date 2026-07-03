
-- 1) Activate all test profiles
UPDATE public.profiles
SET status = 'active'::public.profile_status
WHERE id IN (
  'c4f0ab4c-e92a-405d-ba49-ffa4ef8cce51',
  '2ced4d05-5640-40fc-86dc-fa5d415bb962',
  '5587e878-5bf7-46ef-a273-0e2b46541da3',
  '1a7a2dbc-2b38-4fe6-bc18-12cb115eb132',
  'a92215aa-93ac-4bd9-a0e3-f2c0732179bd',
  '195702d5-57eb-4d7e-bb0a-3d5543b1fdd6',
  '30b3af99-7dc9-4884-bb3f-e29a76b4e60a',
  '4d60a413-11a3-4281-ab30-a6403065e4f3',
  '735ef11d-fcda-4daf-96ea-1253de2c655b'
);

-- 2) Wipe existing role rows for these users so we can set the intended ones cleanly
DELETE FROM public.user_roles
WHERE user_id IN (
  'c4f0ab4c-e92a-405d-ba49-ffa4ef8cce51',
  '2ced4d05-5640-40fc-86dc-fa5d415bb962',
  '5587e878-5bf7-46ef-a273-0e2b46541da3',
  '1a7a2dbc-2b38-4fe6-bc18-12cb115eb132',
  'a92215aa-93ac-4bd9-a0e3-f2c0732179bd',
  '195702d5-57eb-4d7e-bb0a-3d5543b1fdd6',
  '30b3af99-7dc9-4884-bb3f-e29a76b4e60a',
  '4d60a413-11a3-4281-ab30-a6403065e4f3',
  '735ef11d-fcda-4daf-96ea-1253de2c655b'
);

-- 3) Assign intended roles
INSERT INTO public.user_roles (user_id, role) VALUES
  ('c4f0ab4c-e92a-405d-ba49-ffa4ef8cce51', 'super_admin'::public.app_role),
  ('2ced4d05-5640-40fc-86dc-fa5d415bb962', 'admin'::public.app_role),
  ('5587e878-5bf7-46ef-a273-0e2b46541da3', 'admin'::public.app_role),
  ('1a7a2dbc-2b38-4fe6-bc18-12cb115eb132', 'recruiter'::public.app_role),
  ('a92215aa-93ac-4bd9-a0e3-f2c0732179bd', 'lead_recruiter'::public.app_role),
  ('195702d5-57eb-4d7e-bb0a-3d5543b1fdd6', 'senior_recruiter'::public.app_role),
  ('30b3af99-7dc9-4884-bb3f-e29a76b4e60a', 'recruiter'::public.app_role),
  ('4d60a413-11a3-4281-ab30-a6403065e4f3', 'client'::public.app_role),
  ('735ef11d-fcda-4daf-96ea-1253de2c655b', 'client'::public.app_role);
