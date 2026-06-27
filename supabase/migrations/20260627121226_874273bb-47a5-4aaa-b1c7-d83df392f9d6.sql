
create or replace function public.is_client_team_member(_client_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.clients c where c.id = _client_id and c.user_id = _user_id
  ) or exists(
    select 1 from public.client_members m where m.client_id = _client_id and m.user_id = _user_id
  )
$$;

create or replace function public.is_client_team_member_of_position(_position_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.positions p where p.id = _position_id and public.is_client_team_member(p.client_id, _user_id)
  )
$$;

create or replace function public.is_client_team_member_of_thread(_thread_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.message_threads t where t.id = _thread_id and public.is_client_team_member(t.client_id, _user_id)
  )
$$;

-- clients
create policy "client member sees client row" on public.clients for select to authenticated
using (public.is_client_team_member(id, auth.uid()));

-- positions
create policy "client member sees positions" on public.positions for select to authenticated
using (public.is_client_team_member(client_id, auth.uid()));

-- applications
create policy "client member sees shared applications" on public.applications for select to authenticated
using (public.is_client_team_member_of_position(position_id, auth.uid())
  and stage = any (array['shared_with_client','client_shortlist','client_rejected','interview_scheduled','rounds','offered','closed']::application_stage[]));
create policy "client member updates application stage" on public.applications for update to authenticated
using (public.is_client_team_member_of_position(position_id, auth.uid())
  and stage = any (array['shared_with_client','client_shortlist','client_rejected','interview_scheduled']::application_stage[]))
with check (public.is_client_team_member_of_position(position_id, auth.uid()));

-- candidates
create policy "client member sees shared candidates" on public.candidates for select to authenticated
using (exists(
  select 1 from public.applications a join public.positions p on p.id=a.position_id
  where a.candidate_id = candidates.id
    and public.is_client_team_member(p.client_id, auth.uid())
    and a.stage = any (array['shared_with_client','client_shortlist','client_rejected','interview_scheduled','rounds','offered','closed']::application_stage[])
));

-- interviews
create policy "client member sees interviews" on public.interviews for select to authenticated
using (exists(
  select 1 from public.applications a join public.positions p on p.id=a.position_id
  where a.id = interviews.application_id and public.is_client_team_member(p.client_id, auth.uid())
));

-- placements
create policy "client member sees placements" on public.placements for select to authenticated
using (public.is_client_team_member(client_id, auth.uid()));

-- invoices
create policy "client member sees invoices" on public.invoices for select to authenticated
using (public.is_client_team_member(client_id, auth.uid()));

-- documents
create policy "client member sees documents" on public.documents for select to authenticated
using (client_id is not null and public.is_client_team_member(client_id, auth.uid()));

-- message_threads
create policy "client member sees threads" on public.message_threads for select to authenticated
using (public.is_client_team_member(client_id, auth.uid()));

-- messages
create policy "client member sees messages" on public.messages for select to authenticated
using (public.is_client_team_member_of_thread(thread_id, auth.uid()));

-- activities
create policy "client member sees activities" on public.activities for select to authenticated
using (client_visible = true and position_id is not null and public.is_client_team_member_of_position(position_id, auth.uid()));
